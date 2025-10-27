'use client'

import {Button, Checkbox, Dropdown, Input, InputNumber, List, Radio, Slider, Space, Typography} from "antd";
import {DeleteOutlined, PlusOutlined} from "@ant-design/icons";
import {useAppDispatch, useAppSelector} from "../../lib/hooks";
import {useCallback, useEffect, useMemo, useState} from "react";
import {join} from "@tauri-apps/api/path";
import {readTextFile, writeTextFile} from "@tauri-apps/plugin-fs";
import {setLabelState} from "../../lib/features/labels/labelsSlice";
import {getColor, getToothColor} from "../_lib/colors";
import {
    AddInstanceRecord,
    clearHistory,
    LabelRecord,
    PaintRecord, recordHistory, redoStep,
    RemoveInstanceRecord, undoStep
} from "../../lib/features/history/historySlice";
import {RootState} from "../../lib/store";

const LabelItem: React.FC<{
    focused: boolean,
    onFocusChange: () => void,
    instance: number,
    label: number,
    onLabelChange: (label: number) => void,
    onLabelRemove: () => void
}> = ({focused, onFocusChange, instance, label, onLabelChange, onLabelRemove}) => {
    
    const colorBlock = useMemo(() => {
        const color = getToothColor(label)
        return `rgb(${color[0]}, ${color[1]}, ${color[2]})`
    }, [label])
    
    return <div
        style={{
            width: '100%',
            background: focused ? '#ffebc0' : 'transparent',
            padding: 8,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center'
        }}
        onClick={() => {
            onFocusChange()
        }}
    >
        <div style={{width: 24, height: 24, background: colorBlock}}></div>
        <Space.Compact
            style={{width: '100%'}}>
            <Input
                addonBefore={<div>{instance}</div>}
                value={(label === undefined || label === null || isNaN(label)) ? '' : label.toString()}
                onChange={e => {
                    const l = parseInt(e.target.value)
                    if (!isNaN(l)) {
                        onLabelChange(l)
                    } else {
                        onLabelChange(0)
                    }
                }}
            />
            <Button danger icon={<DeleteOutlined />} onClick={() => {
                onLabelRemove()
            }} />
        </Space.Compact>
    </div>
}

const LabelsPanel: React.FC = () => {
    const {raw, instances, labelMap, addRemove, toolMode, paintSize, wireframe, currentInstance, instancePicker, boundingBox} = useAppSelector(state => state.labels)
    const {workDir, selectedFile, candidates} = useAppSelector(state => state.controls.files)
    const {records, top} = useAppSelector((state: RootState) => state.history)
    const dispatch = useAppDispatch()

    const [labelPath, setLabelPath] = useState('')
    const [loading, setLoading] = useState(false)

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
                baseLabelMap.push(0)
            } else if (record instanceof RemoveInstanceRecord) {
                if (record.instance === baseLabelMap.length - 1) {
                    for (let inst = 0; inst < baseInstances.length; inst++) {
                        if (baseInstances[inst] === record.instance) {
                            baseInstances[inst] = 0
                        }
                    }
                    baseLabelMap = baseLabelMap.slice(0, baseLabelMap.length - 1)
                } else {
                    baseLabelMap[record.instance] = 0
                }
            }
        }

        return {
            realLabels: baseInstances.map(i => baseLabelMap[i]),
            instances: baseInstances,
            labelMap: baseLabelMap
        }
    }, [instances, labelMap, records, top])

    const saveResult = useCallback(() => {
        if (!!labelPath) {
            setLoading(true)
            // const realLabels = instances.map(instance => labelMap[instance])
            const newDict = {...raw, labels: currentState.realLabels}
            writeTextFile(labelPath, JSON.stringify(newDict)).then(() => {
                dispatch(setLabelState(state => {
                    state.raw = newDict
                    state.labelMap = currentState.labelMap
                    state.instances = currentState.instances
                    state.currentInstance = -1
                }))
                dispatch(clearHistory())
            }).finally(() => {
                setLoading(false)
            })
        }
    }, [labelPath, raw, currentState.realLabels, currentState.labelMap, currentState.instances, dispatch])

    const reset = useCallback(() => {
        dispatch(clearHistory())
    }, [dispatch])

    const currentPickerColor = useMemo(() => {
        const color = getToothColor(currentState.labelMap[instancePicker] ?? 0);
        return `rgb(${color[0]}, ${color[1]}, ${color[2]})`
    }, [currentState.labelMap, instancePicker])

    useEffect(() => {
        const listener = (e: KeyboardEvent) => {
            if ((e.target as HTMLElement)?.tagName?.toLowerCase() === 'input') {
                return;
            }
            if (e.key.toLowerCase() === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
                e.preventDefault()
                dispatch(undoStep())
            }

            if (e.key.toLowerCase() === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey) {
                e.preventDefault()
                dispatch(redoStep())
            }
            
            if (e.key.toLowerCase() === 'e' && !(e.ctrlKey || e.metaKey || e.shiftKey || e.altKey)) {
                e.preventDefault()
                dispatch(setLabelState(state => {
                    state.addRemove = state.addRemove === 'add' ? 'remove' : 'add';
                }))
            }

            if (e.key.toLowerCase() === 'b' && !(e.ctrlKey || e.metaKey || e.shiftKey || e.altKey)) {
                e.preventDefault()
                dispatch(setLabelState(state => {
                    state.toolMode = 'paint'
                }))
            }

            if (e.key.toLowerCase() === 'l' && !(e.ctrlKey || e.metaKey || e.shiftKey || e.altKey)) {
                e.preventDefault()
                dispatch(setLabelState(state => {
                    state.toolMode = 'lasso'
                }))
            }

            if (e.key.toLowerCase() === 'escape' && !(e.ctrlKey || e.metaKey || e.shiftKey || e.altKey)) {
                e.preventDefault()
                dispatch(setLabelState(state => {
                    state.toolMode = 'none'
                }))
            }

            if (e.key.toLowerCase() === 's' && (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
                e.preventDefault()
                saveResult()
            }

            if (e.key.toLowerCase() === 'q' && !(e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
                e.preventDefault()
                dispatch(setLabelState(state => {
                    state.boundingBox = !state.boundingBox
                }))
            }

            if (e.key.toLowerCase() === 'w' && !(e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
                e.preventDefault()
                dispatch(setLabelState(state => {
                    state.wireframe = !state.wireframe
                }))
            }
        }
        
        document.addEventListener('keydown', listener)
        
        return () => {
            document.removeEventListener('keydown', listener)
        }
    }, [dispatch, saveResult]);

    useEffect(() => {
        if (!!workDir && selectedFile > -1) {
            join(workDir, candidates[selectedFile]).then(modelPath => {
                const labelPath = modelPath.substring(0, modelPath.lastIndexOf('.')) + '.json'
                setLabelPath(labelPath)
            })
        }
    }, [candidates, selectedFile, workDir])

    return <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 16
    }}>
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            border: '1px solid #ccc',
            borderRadius: 8,
            padding: 16
        }}>
            <Typography.Title level={5}>显示</Typography.Title>
            <Checkbox
                checked={wireframe}
                onChange={e => {
                    dispatch(setLabelState(state => {
                        state.wireframe = e.target.checked
                    }))
                }}
            >网格 (W)</Checkbox>
            <Typography.Title level={5}>标注</Typography.Title>
            <Radio.Group
                value={toolMode}
                options={[
                    {
                        label: <span>禁用 (<span style={{textDecoration: ''}}>Esc</span>)</span>,
                        value: 'none'
                    },
                    {
                        label: <span>套索 (<span style={{textDecoration: ''}}>L</span>)</span>,
                        value: 'lasso'
                    },
                    {
                        label: <span>画笔 (<span style={{textDecoration: ''}}>B</span>)</span>,
                        value: 'paint'
                    }
                ]}
                onChange={e => {
                    dispatch(setLabelState(state => {
                        state.toolMode = e.target.value
                    }))
                }}
            />
            <Radio.Group
                value={addRemove}
                style={{
                    display: toolMode === 'none' ? 'none' : undefined
                }}
                options={[
                    {
                        label: <span>添加 (<span style={{textDecoration: ''}}>E</span>)</span>,
                        value: 'add'
                    },
                    {
                        label: <span>擦除 (<span style={{textDecoration: ''}}>E</span>)</span>,
                        value: 'remove'
                    }
                ]}
                onChange={e => {
                    dispatch(setLabelState(state => {
                        state.addRemove = e.target.value
                    }))
                }}
            />
            <div style={{marginTop: 16,
                display: toolMode === 'paint' ? undefined : 'none'}}>
                <div>画笔大小 (CTRL+滚轮)</div>
                <div style={{
                    display: 'flex'
                }}>
                    <Slider
                        value={paintSize}
                        min={1}
                        max={50}
                        step={1}
                        onChange={v => {
                            dispatch(setLabelState(state => {
                                state.paintSize = v
                            }))
                        }}
                        style={{flex: 1}}
                    />
                    <InputNumber
                        value={paintSize.toString()}
                        onChange={e => {
                            dispatch(setLabelState(state => {
                                state.paintSize = parseInt(e)
                            }))
                        }}
                    />
                </div>
            </div>

            <div style={{display: 'flex', gap: 16}}>
                <div>实例选取 (C)</div>
                <div style={{width: 24, height: 24, background: currentPickerColor}} />
                <div>{instancePicker < 0 ? '无选择' : instancePicker} ({currentState.labelMap[instancePicker] ?? 0})</div>
            </div>

            <div style={{display: 'flex', gap: 16}}>
                <div>显示包围盒 (Q)</div>
                <Checkbox checked={boundingBox} onChange={e => {
                    dispatch(setLabelState(state => {
                        state.boundingBox = e.target.checked
                    }))
                }} />
            </div>
        </div>
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 16
        }}>
            <Button style={{flex: 1}} type="text" disabled={records.length === 0 || top < 0} onClick={() => dispatch(undoStep())} loading={loading}>撤销 (CTRL+Z)</Button>
            <Button style={{flex: 1}} type="text" disabled={records.length === 0 || top >= records.length - 1} onClick={() => dispatch(redoStep())}>重做 (CTRL+SHIFT+Z)</Button>
        </div>
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            border: '1px solid #ccc',
            borderRadius: 8,
            padding: 4
        }}>
            {currentState.labelMap.map((label, index) => (
                <LabelItem
                    key={index}
                    focused={currentInstance === index}
                    onFocusChange={() => {
                        dispatch(setLabelState(state => {
                            if (state.currentInstance === index) {
                                state.currentInstance = -1
                            } else {
                                state.currentInstance = index
                            }
                        }))
                    }}
                    instance={index}
                    label={label}
                    onLabelChange={v => {
                        dispatch(recordHistory(new LabelRecord(index, v)))
                    }}
                    onLabelRemove={() => {
                        dispatch(recordHistory(new RemoveInstanceRecord(index)))
                    }}
                />
            ))}
            <Button
                block
                variant="text"
                icon={<PlusOutlined />}
                onClick={() => {
                    dispatch(recordHistory(new AddInstanceRecord()))
                }}
                loading={loading} />
        </div>
        <Button type="primary" onClick={() => saveResult()} loading={loading}>保存 (CTRL+S)</Button>
        <Button danger onClick={() => reset()} disabled={loading}>重置</Button>
    </div>
}

export default LabelsPanel
