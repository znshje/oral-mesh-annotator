import {createSlice} from "@reduxjs/toolkit";

interface OutputState {
    outputDir: string,
    outputToWorkdir: boolean,
    outputFormat: 'png' | 'jpg',
    outputQuality: number,
    backgroundTransparent: boolean,
    outputFilenameFormat: string,
    renderScale: number
}

interface FilesState {
    workDir: string,
    candidates: string[],
    selectedCandidates: string[],
    filePattern: string,
    isFilePatternRegExp: boolean,
    availableFiles: string[],
    selectedFile: number
}

interface UiState {
    tabIndex: string
}

interface RenderState {
    renderDirection: 'vertical' | 'horizontal',
    gap: number,
    normalize: boolean,
    viewportSize: {
        width: number,
        height: number
    },
    focusedCandidate: number
}

export interface ControlsState {
    files: FilesState,
    ui: UiState,
    render: RenderState,
    output: OutputState
}

export const initialState: ControlsState = {
    ui: {
        tabIndex: '0'
    },
    files: {
        workDir: '',
        candidates: [],
        selectedCandidates: [],
        filePattern: '*/oral_scan*.ply',
        isFilePatternRegExp: false,
        availableFiles: [],
        selectedFile: -1
    },
    render: {
        renderDirection: 'horizontal',
        gap: 4,
        normalize: true,
        viewportSize: {
            width: 200,
            height: 180
        },
        focusedCandidate: -1
    },
    output: {
        outputDir: '',
        outputToWorkdir: true,
        outputFormat: 'png',
        outputQuality: 100,
        backgroundTransparent: true,
        outputFilenameFormat: '%name.%ext',
        renderScale: 2
    }
}

export const controlsSlice = createSlice({
    name: 'controls',
    initialState,
    reducers: {
        setState(state, action) {
            state = action.payload(state)
        }
    },
})

export const { setState } = controlsSlice.actions
export default controlsSlice.reducer