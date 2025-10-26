import {GLTFLoader, OBJLoader, PLYLoader, STLLoader, XYZLoader} from "three-stdlib";
import {BufferGeometry} from "three";

type GeometryLoaderType = STLLoader | PLYLoader

const getLoader = (selectedFile: string) => {
    if (!selectedFile) return undefined;
    const ext = selectedFile.substring(selectedFile.lastIndexOf('.') + 1).toLowerCase()
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
}

const parseModel = async (path: string, modelData: string | ArrayBuffer) => {
    const loader = getLoader(path)
    if (!loader) return undefined;

    if (loader instanceof OBJLoader) {
        const model =  loader.parse(modelData as string)
        return model.toJSON()
    } else if (loader instanceof XYZLoader) {
        const model =  await new Promise<BufferGeometry>((resolve, reject) => {
            try {
                loader.parse(modelData as string, geometry => resolve(geometry))
            } catch (e) {
                reject(e)
            }
        });
        return model.toJSON()
    } else {
        const model =  (loader as GeometryLoaderType).parse(modelData);
        return model.toJSON()
    }
}


const functions = {
    parseModel
};

onmessage = e => {
    const {call, args} = e.data;
    if (functions[call]) {
        const result = functions[call](...(args ?? []));
        result
            .then(res => {
                postMessage({
                    type: 'result',
                    call,
                    result: res
                });
            })
            .catch(err => {
                postMessage({
                    type: 'error',
                    call,
                    error: err
                });
            });
    }
};
