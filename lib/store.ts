import {combineReducers, configureStore} from '@reduxjs/toolkit'
import controlsSliceReducer from "./features/controls/controlsSlice";
import historySliceReducer from "./features/history/historySlice";
import cameraSliceReducer from "./features/camera/cameraSlice";
import lightsSliceReducer from "./features/lights/lightsSlice";
import labelsSliceReducer from './features/labels/labelsSlice'
import {readTextFile} from "@tauri-apps/plugin-fs";
import throttle from "lodash.throttle";

import {initialState as controlsInitialState} from "./features/controls/controlsSlice";
import {initialState as lightsInitialState} from './features/lights/lightsSlice'
import {initialState as labelsInitialState} from './features/labels/labelsSlice'

import {invoke} from "@tauri-apps/api/core";
import {error} from "@tauri-apps/plugin-log";
import {appConfigDir, join} from "@tauri-apps/api/path";

const STATE_FILE = 'omastate.json'
// 需要持久化的 slice
const PERSISTED_KEYS = ["controls"];

function isPlainObject(v) {
    return Object.prototype.toString.call(v) === "[object Object]";
}

function deepMerge(target, source) {
    // 如果 source 未定义，返回 target 的深拷贝（保持 target 不变）
    if (source === undefined) {
        // 返回浅拷贝即可，避免修改原 target
        return isPlainObject(target) ? { ...target } : target;
    }

    // 如果 source 不是 plain object（即原始类型、数组、函数、null），直接返回 source
    if (!isPlainObject(source)) {
        // 对于数组/原始值/null，使用 source 覆盖
        return Array.isArray(source) ? source.slice() : source;
    }

    // 现在 source 是 plain object
    const result = isPlainObject(target) ? { ...target } : {};

    for (const key of Object.keys(source)) {
        const sVal = source[key];
        const tVal = (target && Object.prototype.hasOwnProperty.call(target, key)) ? target[key] : undefined;

        if (isPlainObject(sVal) && isPlainObject(tVal)) {
            result[key] = deepMerge(tVal, sVal);
        } else {
            // sVal 可以是原始类型、null、数组 —— 直接赋值（覆盖）
            result[key] = deepMerge(tVal, sVal); // 如果 sVal 是原始则会在第一条分支直接返回 sVal
        }
    }

    return result;
}

const migrateState = (state: RootState) => {
    if (!state) return {}
    if (state.controls) {
        state.controls = deepMerge(controlsInitialState, state.controls);
    }
    if (state.labels) {
        state.labels = deepMerge(labelsInitialState, state.labels);
    }
    if (state.lights) {
        state.lights = deepMerge(lightsInitialState, state.lights);
    }
    return state;
}

async function loadState() {
    try {
        // const appDir = await path.appDataDir();
        // const statePath = await join(appDir, STATE_FILE);
        const statePath = await join(await appConfigDir(), STATE_FILE);
        console.log(statePath)
        const content = await readTextFile(statePath);
        return JSON.parse(content);
    } catch (e) {
        error("No previous state:", e);
        return undefined;
    }
}

// 保存本地状态（只保存部分 slice）
async function saveState(state: RootState) {
    try {
        // const appDir = await path.appDataDir();
        // const statePath = await join(appDir, STATE_FILE);
        const statePath = await join(await appConfigDir(), STATE_FILE);
        console.log(statePath)

        const partial: Record<string, RootState[keyof RootState]> = {};
        for (const key of PERSISTED_KEYS) {
            if (state[key] !== undefined) {
                partial[key] = state[key];
            }
        }
        invoke('save_state', {path: statePath, data: JSON.stringify(partial)})
    } catch (e) {
        error("Failed to save state:", e);
    }
}

const makeStoreSync = ({preloadedState}) => {
    return configureStore({
        reducer: combineReducers({
            controls: controlsSliceReducer,
            history: historySliceReducer,
            camera: cameraSliceReducer,
            lights: lightsSliceReducer,
            labels: labelsSliceReducer
        }),
        preloadedState,
        middleware: (getDefaultMiddleware) => getDefaultMiddleware({
            serializableCheck: false
        }),
    })
}

export const makeStore = async () => {
    const preloadedState = migrateState(await loadState());
    const store = makeStoreSync({preloadedState});

    store.subscribe(
        throttle(() => {
            saveState(store.getState());
        }, 2000)
    );

    return store;
}


// Infer the type of makeStore
export type AppStore = ReturnType<typeof makeStoreSync>
// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<AppStore['getState']>
export type AppDispatch = AppStore['dispatch']