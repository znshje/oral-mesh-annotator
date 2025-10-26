import {createSlice, PayloadAction} from "@reduxjs/toolkit";

export class PaintRecord {
    indices: number[];
    instance: number;

    constructor(indices: number[], instance: number) {
        this.indices = indices;
        this.instance = instance;
    }

    toString() {
        return `PaintRecord: instance ${this.instance}`
    }
}

export class LabelRecord {
    instance: number;
    label: number;

    constructor(instance: number, label: number) {
        this.instance = instance;
        this.label = label;
    }

    toString() {
        return `LabelRecord: instance ${this.instance}, label ${this.label}`
    }
}

export class AddInstanceRecord {
    constructor() {}

    toString() {
        return 'AddInstanceRecord'
    }
}

export class RemoveInstanceRecord {
    instance: number;

    constructor(instance: number) {
        this.instance = instance;
    }

    toString() {
        return `RemoveInstanceRecord: instance ${this.instance}`
    }
}

type HistoryState = {
    records: (PaintRecord | LabelRecord | AddInstanceRecord | RemoveInstanceRecord)[],
    top: number
}

export const initialState: HistoryState ={
    records: [],
    top: -1
}

export const historySlice = createSlice({
    name: 'history',
    initialState,
    reducers: {
        recordHistory: (state, action: PayloadAction<PaintRecord | LabelRecord | AddInstanceRecord | RemoveInstanceRecord>) => {
            if (action.payload instanceof LabelRecord) {
                // 合并对相同instance的修改
                const lastRecord = state.records[state.top]
                if (lastRecord instanceof LabelRecord && lastRecord.instance === action.payload.instance) {
                    return {
                        ...state, records: [...state.records.slice(0, state.top), action.payload]
                    }
                }
            }

            const newRecords = state.records.slice(0, state.top + 1)

            return { ...state, records: [...newRecords, action.payload], top: state.top + 1 }
        },
        clearHistory: () => {
            return initialState
        },
        undoStep: (state) => {
            if (state.records.length === 0) {
                return { ...state, top: -1 }
            }
            return { ...state, top: Math.max(-1, state.top - 1) }
        },
        redoStep: (state) => {
            if (state.records.length === 0) {
                return { ...state, top: -1 }
            }
            return { ...state, top: Math.min(state.top + 1, state.records.length - 1) }
        }
    },
})

export const { recordHistory, clearHistory, undoStep, redoStep } = historySlice.actions
export default historySlice.reducer