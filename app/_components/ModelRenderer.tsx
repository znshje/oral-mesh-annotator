'use client'

import {Canvas, useFrame, useThree} from "@react-three/fiber";
import {useAppDispatch, useAppSelector} from "@/lib/hooks";
import {RootState} from "@/lib/store";
import React, {Suspense, useCallback, useEffect, useMemo, useRef, useState} from "react";
import {
    Box3,
    BufferAttribute,
    BufferGeometry,
    DoubleSide,
    Float32BufferAttribute,
    Group,
    InterleavedBufferAttribute,
    Light,
    LinearSRGBColorSpace,
    Mesh,
    NeutralToneMapping,
    Object3D,
    OrthographicCamera as OrthographicCameraType,
    Vector3
} from "three";
import {ArcballControls, Bvh, Html, OrthographicCamera, useProgress} from "@react-three/drei";
import {readFile, readTextFile} from "@tauri-apps/plugin-fs";
import {
    ArcballControls as ArcballControlsImpl,
    GLTF,
    GLTFLoader,
    OBJLoader,
    PLYLoader,
    STLLoader,
    XYZLoader
} from "three-stdlib";
import {useDebounceEffect} from "ahooks";
import {join} from "@tauri-apps/api/path";
import {updateCamera} from "@/lib/features/camera/cameraSlice";
import {error, info} from "@tauri-apps/plugin-log";
import {
    DirectionalLightJSON,
    HemisphereLightJSON,
    LightParams,
    LightShadow,
    PointLightJSON,
    RectAreaLightJSON,
    SpotLightJSON
} from "@/lib/features/lights/lightsSlice";
import {colorToHex, getToothColor} from "../_lib/colors";
import {setLabelState} from "../../lib/features/labels/labelsSlice";
import {PaintRecord, LabelRecord, AddInstanceRecord, RemoveInstanceRecord} from "@/lib/features/history/historySlice";
import {computeSelectedTriangles} from "./computeSelectedTriangles";
import * as THREE from 'three';
import {acceleratedRaycast, computeBoundsTree, disposeBoundsTree} from "three-mesh-bvh";
import {clearHistory, recordHistory} from "../../lib/features/history/historySlice";
import {mergeGeometries, mergeVertices} from "three/examples/jsm/utils/BufferGeometryUtils";

type AsciiLoaderType = OBJLoader | XYZLoader
type BinaryLoaderType = GLTFLoader | STLLoader | PLYLoader
type LoaderType = AsciiLoaderType | BinaryLoaderType
type GeometryLoaderType = STLLoader | PLYLoader

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

const Loader: React.FC = () => {
    const {progress} = useProgress()

    return <Html center>{progress}% loaded</Html>
}

const parseModel = async (modelData: string | ArrayBuffer, loader: LoaderType) => {
    if (!loader) return undefined;

    if (loader instanceof OBJLoader) {
        return loader.parse(modelData as string)
    } else if (loader instanceof XYZLoader) {
        return await new Promise<BufferGeometry>((resolve, reject) => {
            try {
                loader.parse(modelData as string, geometry => resolve(geometry))
            } catch (e) {
                reject(e)
            }
        })
    } else {
        return (loader as GeometryLoaderType).parse(modelData)
    }
}

const setColor = (model: BufferGeometry, i: number, label: number = 0) => {
    let color: BufferAttribute | InterleavedBufferAttribute
    const points = model.getAttribute('position')
    if (model.hasAttribute('color')) {
        color = model.getAttribute('color');
    } else {
        color = new Float32BufferAttribute(new Float32Array(points.count * 3), 3)
        model.setAttribute('color', color)
    }
    const uniColor = getToothColor(label, true)

    if (i === undefined) {
        for (let j = 0; j < points.count; j++) {
            color.setXYZ(j, uniColor[0], uniColor[1], uniColor[2])
        }
    } else {
        color.setXYZ(i, uniColor[0], uniColor[1], uniColor[2])
    }

    model.getAttribute('color').needsUpdate = true;
}

const setColorAll = (model: BufferGeometry, labels: number[]) => {
    let color: BufferAttribute | InterleavedBufferAttribute
    const points = model.getAttribute('position')
    if (model.hasAttribute('color')) {
        color = model.getAttribute('color');
    } else {
        color = new Float32BufferAttribute(new Float32Array(points.count * 3), 3)
        model.setAttribute('color', color)
    }

    const colorCache = {}
    labels.forEach((label, i) => {
        if (!(label in colorCache)) {
            colorCache[label] = getToothColor(label, true)
        }
        color.setXYZ(i, colorCache[label][0], colorCache[label][1], colorCache[label][2])
    })

    model.getAttribute('color').needsUpdate = true;
}

const PaintMouseCursor: React.FC<{
    eventSource: React.RefObject<HTMLElement>
}> = ({eventSource}) => {
    const {toolMode, paintSize} = useAppSelector((state: RootState) => state.labels)
    const ref = useRef<HTMLDivElement>(null)
    const dispatch = useAppDispatch()

    const mouseMoveEvent = useCallback((e: MouseEvent) => {
        if (ref.current) {
            ref.current.style.left = (e.offsetX - paintSize / 2).toString() + 'px'
            ref.current.style.top = (e.offsetY - paintSize / 2).toString() + 'px'
        }
    }, [paintSize])

    useEffect(() => {
        if (toolMode === 'paint') {
            eventSource.current.style.setProperty('cursor', 'none')
            eventSource.current.addEventListener('mousemove', mouseMoveEvent)
        } else {
            eventSource.current.style.removeProperty('cursor')
            eventSource.current.removeEventListener('mousemove', mouseMoveEvent)
        }
    }, [eventSource, mouseMoveEvent, toolMode])

    useEffect(() => {
        const wheelListener = (e: WheelEvent) => {
            if (e.ctrlKey && !e.altKey && !e.shiftKey) {
                if (toolMode === 'paint') {
                    e.preventDefault()
                    e.stopPropagation()
                    dispatch(setLabelState(state => {
                        state.paintSize = Math.max(1, Math.ceil(state.paintSize - 2 * e.deltaY / 100))
                    }))
                    mouseMoveEvent(e)
                }
            }
        }

        eventSource.current?.addEventListener('wheel', wheelListener, {
            passive: false
        })

        return () => {
            eventSource.current?.removeEventListener('wheel', wheelListener)
        }
    }, [dispatch, eventSource, mouseMoveEvent, toolMode]);
    
    return <div ref={ref} style={{
        width: paintSize,
        height: paintSize,
        border: '1px solid black',
        borderRadius: '50%',
        display: toolMode === 'paint' ? 'block' : 'none',
        position: 'absolute',
        pointerEvents: 'none',
        zIndex: 10
    }} />
}

const params = {
    useBoundsTree: true,
    // selectionMode: "vertex-visible",
    selectionMode: "intersection-visible",
    selectWholeModel: false
}

const Model: React.FC<{
    modelPath: string,
    loader: LoaderType,
    eventSource: React.RefObject<HTMLElement>
}> = ({modelPath, loader, eventSource}) => {
    const [model, setModel] = useState<BufferGeometry>()
    const {
        instances,
        labelMap,
        toolMode,
        paintSize,
        addRemove,
        wireframe,
        currentInstance,
        boundingBox
    } = useAppSelector((state: RootState) => state.labels)
    const {records, top} = useAppSelector((state: RootState) => state.history)
    const dispatch = useAppDispatch()
    const brushActive = useRef(false)
    const lassoActive = useRef(false)
    const lassoDrawing = useRef(false)
    const lassoPoints = useRef<number[][]>([])
    const mouse = useRef({x: 0, y: 0})
    const meshRef = useRef<Mesh>(null)
    const instanceToSubmit = useRef<number>(0)
    const indicesToSubmit = useRef<Set<number>>(new Set())
    const modelPathCache = useRef<string>('')
    const {camera, gl, raycaster, pointer} = useThree()

    const loadLabel = useCallback(async () => {
        if (!modelPath) return;
        const labelPath = modelPath.substring(0, modelPath.lastIndexOf('.')) + '.json'
        try {
            const labelData = await readTextFile(labelPath)
            const labelDict = JSON.parse(labelData) as Record<string, never>
            const labels = labelDict['labels'] as Array<number>
            const instances = []
            const labelMap = []
            labels.forEach(l => {
                if (!labelMap.includes(l)) {
                    labelMap.push(l)
                }
            })
            labelMap.sort((a, b) => a - b)
            labels.forEach(l => {
                const currentInstance = labelMap.indexOf(l)
                instances.push(currentInstance)
            })
            dispatch(setLabelState(state => {
                state.raw = labelDict
                state.instances = instances
                state.labelMap = labelMap
            }))

            console.log('Loaded label', labels.length, ' vertices')
        } catch (e) {
            info(`load label failed: ${e}`)
        }
    }, [dispatch, modelPath])

    const loadModel = useCallback(async () => {
        if (!modelPath) return;

        let data: string | ArrayBuffer
        let model: GLTF | Group | BufferGeometry
        if (loader instanceof GLTFLoader) {
            model = await loader.parseAsync((await readFile(modelPath)).buffer, '')
        } else if (loader instanceof OBJLoader) {
            data = await readTextFile(modelPath);
            model = await parseModel(data, loader)
        } else if (loader instanceof XYZLoader) {
            data = await readTextFile(modelPath);
            model = await parseModel(data, loader)
        } else {
            data = (await readFile(modelPath)).buffer;
            model = await parseModel(data, loader)
        }

        if (model instanceof Group) {
            const geometries = []

            model.traverse(obj => {
                if (obj instanceof Mesh) {
                    geometries.push(mergeVertices(obj.geometry))
                }
            })

            model = mergeGeometries(geometries, false)
        } else if ((model as GLTF).scene) {
            const geometries = [];
            (model as GLTF).scene.traverse(obj => {
                if (obj instanceof Mesh) {
                    geometries.push(mergeVertices(obj.geometry))
                }
            })
            model = mergeGeometries(geometries, false)
        }

        if (model instanceof BufferGeometry) {
            model.center()
            model.computeVertexNormals()
            model.computeBoundsTree()
            model.computeBoundingBox()
            setColor(model, undefined, undefined)

            console.log('Loaded model with ', model.getAttribute('position').count, ' vertices')
        } else {
            throw new Error("Invalid model")
        }

        setModel(prev => {
            if (!prev) return model;
            if (prev instanceof BufferGeometry) {
                if (!!prev.boundsTree) {
                    prev.disposeBoundsTree()
                }
                prev.dispose()
            }
            return model
        })
    }, [modelPath, loader]);

    const currentState = useMemo(() => {
        const baseInstances = [...instances]
        let baseLabelMap = [...labelMap]

        for (let i = 0; i <= top; i++) {
            const record = records[i]
            if (record instanceof PaintRecord) {
                record.indices.forEach(i => baseInstances[i] = record.instance)
            } else if (record instanceof LabelRecord) {
                baseLabelMap[record.instance] = record.label
            } else if (record instanceof AddInstanceRecord) {
                baseInstances.push(baseInstances.length)
                baseLabelMap.push(0)
            } else if (record instanceof RemoveInstanceRecord) {
                if (record.instance === baseLabelMap.length - 1) {
                    baseLabelMap = baseLabelMap.slice(0, baseLabelMap.length - 1)
                } else {
                    baseLabelMap[record.instance] = 0
                }
            }
        }

        return {
            realLabels: baseInstances.map(i => baseLabelMap[i]),
            labelMap: baseLabelMap,
            instances: baseInstances,
        }
    }, [instances, labelMap, records, top])

    const updateInstances = useCallback((indices: number[], inst: number) => {
        instanceToSubmit.current = inst
        indicesToSubmit.current = indicesToSubmit.current.union(new Set(indices))
    }, [])

    //////////////// Paint tool ////////////////

    const performPaint = useCallback((e: PointerEvent) => {
        const srcWidth = (e.target as HTMLDivElement).clientWidth
        const srcHeight = (e.target as HTMLDivElement).clientHeight

        const mx = e.offsetX
        const my = e.offsetY
        mouse.current.x = mx
        mouse.current.y = my
        const points = []
        // draw a circle as lasso
        const segments = Math.ceil(6 * paintSize)
        for (let i = 0; i < segments; i++) {
            const angle = 360 / segments * i * Math.PI / 180
            const x = Math.cos(angle) * paintSize / 2
            const y = Math.sin(angle) * paintSize / 2
            points.push([
                (x + mx) / srcWidth * 2 - 1,
                -((y + my) / srcHeight * 2 - 1),
                0
            ])
        }
        const indices = computeSelectedTriangles(meshRef.current, camera, {points: points.flat()}, params)
        if (indices.length > 0) {
            indices.forEach(index => {
                // state.instances[index] = addRemove === 'add' ? currentInstance : 0
                setColor(meshRef.current.geometry, index, addRemove === 'add' ? currentState.labelMap[currentInstance] : 0)
            })
            updateInstances(indices, addRemove === 'add' ? currentInstance : 0)
        }
    }, [addRemove, camera, currentInstance, currentState.labelMap, paintSize, updateInstances])

    const paintMouseMoveEvent = useCallback((e: PointerEvent) => {
        if (brushActive.current) {
            performPaint(e)
        }
    }, [performPaint])

    const paintMouseDownEvent = useCallback((e: PointerEvent) => {
        brushActive.current = (e.button === 0) && currentInstance > -1
        if (brushActive.current) {
            indicesToSubmit.current.clear()
            instanceToSubmit.current = currentInstance
            performPaint(e)
        }
    }, [currentInstance, performPaint])

    const paintMouseUpEvent = useCallback((e: PointerEvent) => {
        if (brushActive.current) {
            dispatch(recordHistory(new PaintRecord([...indicesToSubmit.current], instanceToSubmit.current)))
        }
        indicesToSubmit.current.clear()
        instanceToSubmit.current = 0
        brushActive.current = false
    }, [dispatch])

    //////////////// Paint tool ////////////////

    //////////////// Lasso tool ////////////////

    const lassoUpdatePath = useCallback(() => {
        const svg = document.getElementById('lasso-svg')
        const existingPath = document.getElementById('lasso-path');
        let pathData = lassoPoints.current.map(p => p.join(',')).join(' ');

        if (lassoActive.current && !lassoDrawing.current) {
            // 有引导线
            pathData += ` ${mouse.current.x},${mouse.current.y}`
        }

        if (existingPath) {
            existingPath.setAttribute('points', pathData);
        } else {
            const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
            polyline.setAttribute('id', 'lasso-path');
            polyline.setAttribute('points', pathData);
            polyline.setAttribute('fill', 'rgba(0, 0, 0, 0.05)');
            polyline.setAttribute('stroke', 'black');
            polyline.setAttribute('stroke-width', '1');
            svg.appendChild(polyline);
        }
    }, [])

    const performLassoDraw = useCallback(() => {
        const svg = document.getElementById('lasso-svg')
        const srcWidth = svg.clientWidth
        const srcHeight = svg.clientHeight

        const points = lassoPoints.current.map(point => [point[0] / srcWidth * 2 - 1, -point[1] / srcHeight * 2 + 1, 0])

        const indices = computeSelectedTriangles(meshRef.current, camera, {points: points.flat()}, params)
        if (indices.length > 0) {
            indices.forEach(index => {
                // state.instances[index] = addRemove === 'add' ? currentInstance : 0
                setColor(meshRef.current.geometry, index, addRemove === 'add' ? currentState.labelMap[currentInstance] : 0)
            })
            updateInstances(indices, addRemove === 'add' ? currentInstance : 0)
        }
    }, [addRemove, camera, currentInstance, currentState.labelMap, updateInstances])

    const lassoMouseMoveEvent = useCallback((e: PointerEvent) => {
        if (lassoActive.current) {
            mouse.current = {
                x: e.offsetX,
                y: e.offsetY
            }

            if (lassoDrawing.current) {
                lassoPoints.current.push([e.offsetX, e.offsetY]);
                lassoUpdatePath();
            } else {
                // 画出引导线
                lassoUpdatePath();
            }

        }
    }, [lassoUpdatePath])

    const lassoMouseDownEvent = useCallback((e: PointerEvent) => {
        if ((e.button === 0) && currentInstance > -1) {
            mouse.current = {
                x: e.offsetX,
                y: e.offsetY
            }

            if (!lassoActive.current) {
                // 激活新的套索选区
                indicesToSubmit.current.clear()
                instanceToSubmit.current = 0
                lassoActive.current = true;
                lassoPoints.current = [[e.offsetX, e.offsetY]]
                lassoUpdatePath()
            } else {
                lassoPoints.current.push([e.offsetX, e.offsetY])
                lassoUpdatePath()
            }
            lassoDrawing.current = true
        }
    }, [currentInstance, lassoUpdatePath])

    const lassoMouseUpEvent = useCallback((e: PointerEvent) => {
        lassoDrawing.current = false
    }, [])

    const lassoFinishSelection = useCallback(() => {
        lassoActive.current = false;
        lassoDrawing.current = false;

        // 提交
        performLassoDraw()

        dispatch(recordHistory(new PaintRecord([...indicesToSubmit.current], instanceToSubmit.current)))

        indicesToSubmit.current.clear()
        instanceToSubmit.current = 0

        lassoPoints.current = []
        lassoUpdatePath()
    }, [dispatch, lassoUpdatePath, performLassoDraw])

    const lassoAddPoint = useCallback(e => {
        if (lassoActive.current) {
            if (lassoPoints.current.length > 1) {
                if (Math.abs(lassoPoints.current[0][0] - e.offsetX) < 3 &&
                    Math.abs(lassoPoints.current[0][1] - e.offsetY) < 3) {
                    // 点间距过近，关闭
                    lassoFinishSelection()
                }
            }

            lassoUpdatePath();
        }
    }, [lassoFinishSelection, lassoUpdatePath])

    //////////////// Lasso tool ////////////////

    //////////////// Instance picker ////////////////

    const instancePickerListener = useCallback((e: KeyboardEvent) => {
        if (e.key.toLowerCase() === 'c' && !(e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
            e.preventDefault()

            raycaster.setFromCamera(pointer, camera)
            const intersections = raycaster.intersectObject(meshRef.current)

            if (intersections.length > 0) {
                dispatch(setLabelState(state => {
                    state.instancePicker = currentState.instances[intersections[0].face.a];
                    state.currentInstance = state.instancePicker;
                }))
            }
        }
    }, [camera, currentState.instances, dispatch, pointer, raycaster])

    //////////////// Tooth bounding boxes ////////////////

    const toothBoundingBoxes = useMemo(() => {
        if (!model || !boundingBox) return [];
        const tempVec = new Vector3()
        const position = (model as BufferGeometry).getAttribute('position').array
        const boxes = labelMap.map(_ => new Box3())
        const labels = currentState.realLabels
        currentState.instances.forEach((inst, i) => {
            if (labels[i] === 0) return;
            tempVec.set(position[i * 3], position[i * 3 + 1], position[i * 3 + 2])
            boxes[inst].expandByPoint(tempVec)
        })
        return boxes;
    }, [boundingBox, currentState.instances, currentState.realLabels, labelMap, model])

    useEffect(() => {
        window.addEventListener('keypress', instancePickerListener)
        return () => {
            window.removeEventListener('keypress', instancePickerListener)
        }
    }, [instancePickerListener]);

    useDebounceEffect(() => {
        try {
            dispatch(clearHistory())
            if (modelPath === modelPathCache.current) return;

            modelPathCache.current = modelPath;
            loadModel().then(() => loadLabel())
        } catch (e) {
            error(`load model failed: ${e}`)
            setModel(prev => {
                if (!prev) return null;
                if (prev instanceof BufferGeometry) {
                    prev.dispose()
                }
                return null
            })
        }
        return () => {
        }
    }, [loadModel, loadLabel, modelPath, dispatch], {
        wait: 5
    })

    useDebounceEffect(() => {
        if (model) {
            if (model instanceof BufferGeometry) {
                setColorAll(model, currentState.realLabels)
            }
        }
    }, [currentState.realLabels, model], {
        wait: 50
    })

    useEffect(() => {
        // 初始化绘制工具
        if (toolMode === 'lasso') {
            lassoActive.current = false
            lassoDrawing.current = false
            lassoPoints.current = []
            lassoUpdatePath()
        } else if (toolMode === 'paint') {
            brushActive.current = false
        }
    }, [toolMode, lassoUpdatePath]);

    useEffect(() => {
        let added = 'none'
        const lassoKeyboardEvent = e => {
            if (e.key.toLowerCase() === 'enter') {
                lassoFinishSelection()
            }
        }
        if (gl && gl.domElement && eventSource.current) {
            if (toolMode === 'paint') {
                added = 'paint'
                eventSource.current.addEventListener('pointermove', paintMouseMoveEvent)
                eventSource.current.addEventListener('pointerdown', paintMouseDownEvent)
                eventSource.current.addEventListener('pointerup', paintMouseUpEvent)
            } else if (toolMode === 'lasso') {
                added = 'lasso'
                eventSource.current.addEventListener('pointermove', lassoMouseMoveEvent)
                eventSource.current.addEventListener('pointerdown', lassoMouseDownEvent)
                eventSource.current.addEventListener('pointerup', lassoMouseUpEvent)
                eventSource.current.addEventListener('click', lassoAddPoint)
                eventSource.current.addEventListener('dblclick', lassoFinishSelection)
                window.addEventListener('keypress', lassoKeyboardEvent)
            }
        }

        return () => {
            if (gl && gl.domElement && added && eventSource.current) {
                if (added === 'paint') {
                    eventSource.current.removeEventListener('pointermove', paintMouseMoveEvent)
                    eventSource.current.removeEventListener('pointerdown', paintMouseDownEvent)
                    eventSource.current.removeEventListener('pointerup', paintMouseUpEvent)
                } else if (added === 'lasso') {
                    eventSource.current.removeEventListener('pointermove', lassoMouseMoveEvent)
                    eventSource.current.removeEventListener('pointerdown', lassoMouseDownEvent)
                    eventSource.current.removeEventListener('pointerup', lassoMouseUpEvent)
                    eventSource.current.removeEventListener('click', lassoAddPoint)
                    eventSource.current.removeEventListener('dblclick', lassoFinishSelection)
                    window.removeEventListener('keypress', lassoKeyboardEvent)
                }
            }
        }
    }, [eventSource, gl, lassoAddPoint, lassoFinishSelection, lassoMouseDownEvent, lassoMouseMoveEvent, lassoMouseUpEvent, paintMouseDownEvent, paintMouseMoveEvent, paintMouseUpEvent, toolMode]);

    if (!model) {
        return <></>
    }

    let ret
    if (model instanceof BufferGeometry) {
        ret = <>
            <mesh ref={meshRef} geometry={model}>
                <meshPhysicalMaterial vertexColors={true} side={DoubleSide} />
            </mesh>

            <mesh geometry={model} visible={wireframe}>
                <meshPhysicalMaterial color={0x000000} side={DoubleSide} wireframe={true} />
            </mesh>
        </>
    } else {
        ret = <>
            {model && <primitive
                ref={meshRef}
                object={model}
            />}
        </>
    }
    return <>
        {ret}
        {toothBoundingBoxes.map((bbox, i) => (
            <box3Helper
                visible={currentState.labelMap[i] > 0}
                key={`helper-bbox-${i}`}
                args={[bbox, colorToHex(getToothColor(currentState.labelMap[i]))]} />
        ))}
    </>
}

const LightObject = ({light}: { light: LightParams }) => {
    const lightRef = useRef<Light>(null)
    const vec3 = useRef(new Vector3())

    useEffect(() => {
        if (lightRef.current && !light.bindView) {
            if (['directional', 'spot', 'point'].includes(light.type)) {
                lightRef.current.position.fromArray((light as LightShadow).position)
                if (typeof lightRef.current.lookAt === 'function') {
                    if ((light as LightShadow).lookAt) {
                        lightRef.current.lookAt((light as LightShadow).lookAt[0], (light as LightShadow).lookAt[1], (light as LightShadow).lookAt[2])
                    } else {
                        lightRef.current.lookAt(0, 0, 0)
                    }
                }
            }
        }
    }, [light, light.bindView]);

    useFrame(({camera}) => {
        if (lightRef.current && light.bindView) {
            lightRef.current.position.copy(camera.position)
            if (typeof lightRef.current.lookAt === 'function') {
                camera.getWorldDirection(vec3.current)
                vec3.current.add(camera.position)
                lightRef.current.lookAt(vec3.current)
            }
        }
    })

    switch (light.type) {
        case 'ambient':
            return <ambientLight ref={lightRef} intensity={light.intensity * Math.PI} color={light.color}
                                 visible={light.enabled} />
        case 'directional':
            const directional = (light as DirectionalLightJSON)
            return <directionalLight
                ref={lightRef}
                visible={light.enabled}
                intensity={directional.intensity * Math.PI}
                color={directional.color}
                position={directional.position}
                lookAt={directional.lookAt}
                castShadow={directional.castShadow}
            />
        case 'hemisphere':
            const hemisphere = (light as HemisphereLightJSON)
            return <hemisphereLight
                ref={lightRef}
                args={[hemisphere.skyColor, hemisphere.groundColor, hemisphere.intensity * Math.PI]}
                visible={light.enabled}
            />
        case 'point':
            const point = (light as PointLightJSON)
            return <pointLight
                ref={lightRef}
                intensity={point.intensity * Math.PI}
                position={point.position}
                color={point.color}
                distance={point.distance}
                decay={point.decay}
                castShadow={point.castShadow}
                visible={light.enabled}
            />
        case 'rectarea':
            const rectarea = (light as RectAreaLightJSON)
            return <rectAreaLight
                ref={lightRef}
                intensity={rectarea.intensity * Math.PI}
                color={rectarea.color}
                width={rectarea.width}
                height={rectarea.height}
                visible={light.enabled}
            />
        case 'spot':
            const spot = (light as SpotLightJSON)
            return <spotLight
                ref={lightRef}
                intensity={spot.intensity * Math.PI}
                position={spot.position}
                color={spot.color}
                distance={spot.distance}
                angle={spot.angle}
                penumbra={spot.penumbra}
                castShadow={spot.castShadow}
                visible={light.enabled}
            />
        default:
            return <></>
    }
}

const Lights = () => {
    const {lights} = useAppSelector((state: RootState) => state.lights)
    return <>
        {lights.map((light, index) => <LightObject light={light} key={index} />)}
    </>
}

export function CameraController() {
    const dispatch = useAppDispatch()
    const cameraState = useAppSelector((state: RootState) => state.camera)
    const cameraRef = useRef<OrthographicCameraType>(null)
    const controlsRef = useRef<ArcballControlsImpl>(null)
    const v3 = useRef(new Vector3())

    const {controls, camera, gl} = useThree()

    useEffect(() => {
        if (cameraState.controlUpdateRequired) {
            if (!camera) return

            const originWorld = camera.matrixWorldAutoUpdate
            const origin = camera.matrixAutoUpdate
            // eslint-disable-next-line react-hooks/immutability
            camera.matrixAutoUpdate = false
            camera.matrixWorldAutoUpdate = false

            camera.position.fromArray(cameraState.position)
            camera.quaternion.fromArray(cameraState.quaternion as [number, number, number, number]);
            camera.zoom = cameraState.zoom;
            camera.up.copy(Object3D.DEFAULT_UP)
            camera.updateProjectionMatrix();

            camera.updateMatrix();
            camera.updateMatrixWorld(true);

            camera.matrixAutoUpdate = origin;
            camera.matrixWorldAutoUpdate = originWorld;

            controlsRef.current.reset()
            // @ts-expect-error setCamera is not private in original three.js
            controlsRef.current.setCamera(camera)
        }
    }, [camera, cameraState.controlUpdateRequired, cameraState.position, cameraState.quaternion, cameraState.zoom, controls]);

    useEffect(() => {
        if (controls) {
            // @ts-expect-error mouseActions is not private in original three.js
            controlsRef.current.mouseActions = []
            // @ts-expect-error setMouseAction is not private in original three.js
            controlsRef.current.setMouseAction('ROTATE', 0, 'CTRL')
            // @ts-expect-error setMouseAction is not private in original three.js
            controlsRef.current.setMouseAction('ROTATE', 2)
            // @ts-expect-error setMouseAction is not private in original three.js
            controlsRef.current.setMouseAction('PAN', 1)
            // @ts-expect-error setMouseAction is not private in original three.js
            controlsRef.current.setMouseAction('ZOOM', 'WHEEL')
        }
    }, [controls])

    useEffect(() => {
        if (!controls) return

        // handler：在 capture 阶段尝试阻止缩放
        const onWheelCapture = (event) => {
            // 如果按下 Ctrl 或 Shift，就阻止默认缩放行为
            if (event.ctrlKey || event.shiftKey) {
                // 并且从控件层面禁止缩放（以防库内部在别处处理）
                try { controls.enableZoom = false } catch (e) {}
            } else {
                // 在没有按键时确保 enableZoom 打开
                try { controls.enableZoom = true } catch (e) {}
            }
        }

        // 当用户按下/松开键时，也更新 enableZoom（提高响应性）
        const onKeyDown = (e) => {
            if (e.key === 'Control' || e.key === 'Shift') {
                try { controls.enableZoom = false } catch (err) {}
            }
        }
        const onKeyUp = (e) => {
            if (e.key === 'Control' || e.key === 'Shift') {
                try { controls.enableZoom = true } catch (err) {}
            }
        }

        // 注册在捕获阶段并确保 passive:false，使得 preventDefault 有效
        controls.domElement.addEventListener('wheel', onWheelCapture, { passive: false, capture: true })
        // 也在 window 上注册以防控件监听在别处
        window.addEventListener('wheel', onWheelCapture, { passive: false, capture: true })

        window.addEventListener('keydown', onKeyDown)
        window.addEventListener('keyup', onKeyUp)

        // 清理
        return () => {
            controls.domElement.removeEventListener('wheel', onWheelCapture, { capture: true })
            window.removeEventListener('wheel', onWheelCapture, { capture: true })
            window.removeEventListener('keydown', onKeyDown)
            window.removeEventListener('keyup', onKeyUp)
            try { controls.enableZoom = true } catch (e) {}
        }
    }, [gl, controls])

    return (
        <>
            <OrthographicCamera makeDefault ref={cameraRef} position={[0, 0, 150]} zoom={5} />
            <ArcballControls makeDefault ref={controlsRef} camera={cameraRef.current!} onChange={() => {
                const cam = cameraRef.current
                if (!cam) return

                camera.getWorldDirection(v3.current);
                dispatch(updateCamera({
                    position: [cam.position.x, cam.position.y, cam.position.z],
                    quaternion: [cam.quaternion.x, cam.quaternion.y, cam.quaternion.z, cam.quaternion.w],
                    zoom: cam.zoom,
                    worldDirection: v3.current.toArray()
                }))
            }} />
        </>
    )
}

function SyncCameraFromStore() {
    const cameraState = useAppSelector((state: RootState) => state.camera)
    const {camera} = useThree()

    useEffect(() => {
        if (!camera) return

        const originWorld = camera.matrixWorldAutoUpdate
        const origin = camera.matrixAutoUpdate
        // eslint-disable-next-line react-hooks/immutability
        camera.matrixAutoUpdate = false
        camera.matrixWorldAutoUpdate = false

        camera.position.fromArray(cameraState.position)
        camera.quaternion.fromArray(cameraState.quaternion as [number, number, number, number])
        camera.zoom = cameraState.zoom
        camera.updateProjectionMatrix()

        camera.updateMatrix()
        camera.updateMatrixWorld(true)

        camera.matrixAutoUpdate = origin;
        camera.matrixWorldAutoUpdate = originWorld;
    }, [camera, cameraState]);

    return null
}

const Scene = ({path, loader, eventSource}: {
    path: string,
    loader: LoaderType,
    eventSource: React.RefObject<HTMLDivElement>
}) => {

    return <>
        <Lights />
        <SyncCameraFromStore />

        <Suspense fallback={<Loader />}>
            <Model modelPath={path} loader={loader} eventSource={eventSource} />
        </Suspense>
    </>
}


const ModelRenderer: React.FC = () => {
    const {workDir, candidates, selectedFile} = useAppSelector((state: RootState) => state.controls.files);
    const {toolMode} = useAppSelector((state: RootState) => state.labels);
    const containerRef = useRef<HTMLDivElement>(null)

    const [modelPath, setModelPath] = useState<string>(undefined)

    const canvasRef = useRef<HTMLCanvasElement>(null);

    const loader = useMemo(() => {
        if (selectedFile < 0 || !candidates || candidates.length === 0) return undefined;
        const ext = candidates[selectedFile].substring(candidates[selectedFile].lastIndexOf('.') + 1).toLowerCase()
        if (ext === 'glb' || ext === 'gltf') {
            return new GLTFLoader()
        } else if (ext === 'obj') {
            return new OBJLoader()
        } else if (ext === 'stl') {
            return new STLLoader()
        } else if (ext === 'ply') {
            return new PLYLoader()
        } else if (ext === 'xyz') {
            return new XYZLoader()
        }
        return null
    }, [candidates, selectedFile]);

    useDebounceEffect(() => {
        (async () => {
            if (candidates && selectedFile > -1) {
                setModelPath(await join(workDir, candidates[selectedFile]))
            }
        })()
    }, [selectedFile, candidates], {
        wait: 50
    });

    if (loader === null) {
        return <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
        }}>不支持该文件格式：{selectedFile}</div>
    }

    return <div
        ref={containerRef}
        style={{
            width: '100%',
            height: '100%',
            position: 'relative',
            overflow: 'hidden'
        }}>
        <svg id="lasso-svg" style={{
            width: '100%',
            height: '100%',
            background: 'transparent',
            position: 'absolute',
            inset: 0,
            display: toolMode === "lasso" ? 'block' : 'none',
            zIndex: 10
        }} />
        <PaintMouseCursor eventSource={containerRef} />
        <Canvas
            ref={canvasRef}
            eventSource={containerRef}
            gl={{
                toneMapping: NeutralToneMapping,
                alpha: true,
                outputColorSpace: LinearSRGBColorSpace
            }}
        >
            <Bvh firstHitOnly>
                <CameraController />
                <Scene path={modelPath} loader={loader} eventSource={containerRef} />
            </Bvh>
        </Canvas>
    </div>
}

export default ModelRenderer;