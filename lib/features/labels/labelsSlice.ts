import {createSlice} from "@reduxjs/toolkit";

interface LabelsState {
    toolMode: 'lasso' | 'paint' | 'none',
    addRemove: 'add' | 'remove',
    instances: number[],
    raw: Record<never, never>,
    labelMap: number[],
    paintSize: number,
    wireframe: boolean,
    currentInstance: number
}

export const initialState: LabelsState = {
    toolMode: 'none',
    addRemove: 'add',
    raw: {},
    instances: [],
    labelMap: [],
    paintSize: 10,
    wireframe: false,
    currentInstance: -1
}

export const labelsSlice = createSlice({
    name: 'labels',
    initialState,
    reducers: {
        setLabelState(state, action) {
            state = action.payload(state)
        }
    },
})

export const { setLabelState } = labelsSlice.actions
export default labelsSlice.reducer