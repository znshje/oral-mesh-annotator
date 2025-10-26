'use client'

import {Button, Checkbox, Input, Select, Space, Typography} from "antd";
import {useAppDispatch, useAppSelector} from "@/lib/hooks";
import {RootState} from "@/lib/store";
import {setState} from "@/lib/features/controls/controlsSlice";
import {ArrowLeftOutlined, ArrowRightOutlined, FolderOpenOutlined} from "@ant-design/icons";
import {open} from "@tauri-apps/plugin-dialog";
import {readDir} from "@tauri-apps/plugin-fs";
import {debug, error} from "@tauri-apps/plugin-log";
import {useEffect, useState} from "react";
import {minimatch} from "minimatch";
import {useDebounceEffect} from "ahooks";

const FileSelector: React.FC = () => {
    const {workDir, candidates, filePattern, selectedFile} = useAppSelector((state: RootState) => state.controls.files);
    const dispatch = useAppDispatch();
    const [loading, setLoading] = useState(false);

    const readDirRecursive = async (dir, basePath = '') => {
        const entries = await readDir(dir)
        let results = []
        for (const entry of entries) {
            if (!entry.name) continue
            const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name
            if (entry.isDirectory) {
                const subResults = await readDirRecursive(`${dir}/${entry.name}`, relativePath)
                results = results.concat(subResults)
            } else {
                if (minimatch(relativePath, filePattern ?? '*')) {
                    results.push(relativePath)
                }
            }
        }
        return results
    }

    const loadCandidates = async (root: string) => {
        if (!root) {
            return []
        }
        setLoading(true)
        try {
            const candidates = await readDirRecursive(root)
            debug(candidates.join(', '))
            dispatch(setState(state => {
                state.files.candidates = candidates
                state.files.selectedCandidates = candidates
            }))
            return candidates
        } catch (e) {
            error(e)
            dispatch(setState(state => {
                state.files.candidates = []
                state.files.selectedCandidates = []
            }))
            return []
        } finally {
            setLoading(false)
        }
    }

    useDebounceEffect(() => {
        loadCandidates(workDir).then((candidates) => {
            if (candidates.length > 0) {
                dispatch(setState(state => state.files.selectedFile = 0))
            } else {
                dispatch(setState(state => state.files.selectedFile = -1))
            }
        })
    }, [workDir, filePattern])

    return <div style={{
        width: '100%',
        display: 'flex',
        gap: 16,
        padding: 16,
        boxSizing: 'border-box'
    }}>
        <div style={{flex: 2}}>
            <Space.Compact style={{width: '100%'}}>
                <Input
                    disabled={loading}
                    placeholder="选择工作目录"
                    value={workDir ?? ''}
                    onChange={(e) => dispatch(setState(state => state.files.workDir = e.target.value))}
                />
                <Button loading={loading} icon={<FolderOpenOutlined/>} onClick={() => {
                    open({
                        directory: true,
                    }).then((selected) => {
                        dispatch(setState(state => state.files.workDir = selected))
                        // loadCandidates(selected).then((candidates) => {
                        //     if (candidates.length > 0) {
                        //         dispatch(setState(state => state.files.selectedFile = 0))
                        //     } else {
                        //         dispatch(setState(state => state.files.selectedFile = -1))
                        //     }
                        // })
                    });
                }}/>
            </Space.Compact>
        </div>
        <Input
            style={{flex: 1}}
            disabled={loading}
            placeholder="文件匹配"
            value={filePattern ?? ''}
            onChange={(e) => dispatch(setState(state => state.files.filePattern = e.target.value))}
        />
        <Select
            disabled={loading}
            style={{flex: 2}}
            placeholder="选择文件"
            value={selectedFile === -1 ? undefined : selectedFile}
            options={(candidates ?? []).map((candidate, index) => ({
                label: candidate,
                value: index,
                key: index
            }))}
            onChange={(value) => dispatch(setState(state => {
                state.files.selectedFile = value
            }))}
        />
        <Space.Compact>
            <Button type="primary" disabled={selectedFile < 1} icon={<ArrowLeftOutlined/>} onClick={() => {
                dispatch(setState(state => state.files.selectedFile = selectedFile - 1))
            }}></Button>
            <Button type="primary" disabled={selectedFile >= candidates.length - 1} icon={<ArrowRightOutlined/>} onClick={() => {
                dispatch(setState(state => state.files.selectedFile = selectedFile + 1))
            }}></Button>
        </Space.Compact>
    </div>
}

export default FileSelector;