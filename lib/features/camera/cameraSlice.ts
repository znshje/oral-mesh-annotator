import {createSlice, PayloadAction} from "@reduxjs/toolkit";

export interface CameraParams {
    type?: 'orthographic' | 'perspective'
    position: [number, number, number]
    quaternion: [number, number, number, number]
    zoom: number,
    worldDirection: [number, number, number]
}

interface CameraRecords {
    id: number,
    label: string,
    state: CameraState
}

type CameraState = CameraParams & {
    records: CameraRecords[],
    controlUpdateRequired: boolean
}

export const initialState: CameraState ={
    type: 'orthographic',
    position: [0, 0, 150],
    quaternion: [0, 0, 0, 1],
    zoom: 5,
    records: [],
    controlUpdateRequired: false,
    worldDirection: [0, 0, -1]
}

export const cameraSlice = createSlice({
    name: 'camera',
    initialState,
    reducers: {
        updateCamera: (state, action: PayloadAction<CameraParams>) => {
            return { ...state, ...action.payload, controlUpdateRequired: false }
        },
        resetCamera: (state) => {
            return { ...initialState, records: state.records, controlUpdateRequired: true }
        }
    },
})

export const { updateCamera, resetCamera } = cameraSlice.actions
export default cameraSlice.reducer