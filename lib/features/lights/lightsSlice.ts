import {createSlice} from "@reduxjs/toolkit";

type Color = number | string

type LightProps = {
    name: string,
    enabled: boolean,
    bindView: boolean
}

type LightJSON = {
    type: 'ambient' | 'directional' | 'hemisphere' | 'point' | 'rectarea' | 'spot',
    intensity: number,
    color: Color,
}

export type LightShadow = {
    castShadow: boolean,
    position: [number, number, number],
    lookAt?: [number, number, number]
}

export type AmbientLightJSON = LightJSON

export type DirectionalLightJSON = LightJSON & LightShadow

export type HemisphereLightJSON = LightJSON & {
    skyColor: Color,
    groundColor: Color,
}

export type PointLightJSON = LightJSON & LightShadow & {
    distance: number,
    decay: number,
    power: number,
}

export type RectAreaLightJSON = LightJSON & {
    width: number,
    height: number,
}

export type SpotLightJSON = LightJSON & LightShadow & PointLightJSON & {
    angle: number,
    penumbra: number,
}

export type LightParams = (AmbientLightJSON | DirectionalLightJSON | HemisphereLightJSON | PointLightJSON | RectAreaLightJSON | SpotLightJSON) & LightProps

type LightsState = {
    lights: LightParams[]
}

export const defaultAmbientLight: AmbientLightJSON & LightProps = {
    type: 'ambient',
    intensity: 1,
    color: '#ffffff',
    name: '环境光',
    enabled: true,
    bindView: false
}

export const defaultDirectionalLight: DirectionalLightJSON & LightProps = {
    type: 'directional',
    castShadow: true,
    lookAt: [0, 0, 0],
    position: [0, 0, 1],
    intensity: 1,
    color: '#ffffff',
    name: '平行光',
    enabled: true,
    bindView: false
}

export const defaultHemisphereLight: HemisphereLightJSON & LightProps = {
    type: 'hemisphere',
    intensity: 1,
    color: '#ffffff',
    skyColor: '#ffffff',
    groundColor: '#ffffff',
    name: '半球光',
    enabled: true,
    bindView: false
}

export const defaultPointLight: PointLightJSON & LightProps = {
    type: 'point',
    intensity: 1,
    color: '#ffffff',
    distance: 10,
    decay: 1,
    power: 1,
    position: [0, 0, 1],
    lookAt: [0, 0, 0],
    castShadow: true,
    name: '点光源',
    enabled: true,
    bindView: false
}

export const defaultRectAreaLight: RectAreaLightJSON & LightProps = {
    type: 'rectarea',
    intensity: 1,
    color: '#ffffff',
    width: 10,
    height: 10,
    name: '矩形光',
    enabled: true,
    bindView: false
}

export const defaultSpotLight: SpotLightJSON & LightProps = {
    type: 'spot',
    intensity: 1,
    color: '#ffffff',
    distance: 10,
    decay: 1,
    power: 1,
    position: [0, 0, 1],
    lookAt: [0, 0, 0],
    castShadow: true,
    angle: 0.5,
    penumbra: 0.5,
    name: '聚光灯',
    enabled: true,
    bindView: false
}

export const defaultLightConfig: Record<string, LightParams> = {
    ambient: defaultAmbientLight,
    directional: defaultDirectionalLight,
    hemisphere: defaultHemisphereLight,
    point: defaultPointLight,
    rectarea: defaultRectAreaLight,
    spot: defaultSpotLight,
}

export const initialState: LightsState = {
    lights: [
        {
            type: 'ambient',
            intensity: 0.2,
            color: '#ffffff',
            name: '环境光',
            enabled: true,
            bindView: false
        },
        {
            type: 'directional',
            intensity: 0.4,
            color: '#ffffff',
            position: [0, -150, 0],
            name: '平行光 1',
            enabled: true,
            bindView: false
        },
        {
            type: 'directional',
            intensity: 0.5,
            color: '#ffffff',
            position: [-200, 0, 0],
            name: '平行光 2',
            enabled: true,
            bindView: false
        },
        {
            type: 'directional',
            intensity: 0.5,
            color: '#ffffff',
            position: [200, 0, 0],
            name: '平行光 3',
            enabled: true,
            bindView: false
        },
        {
            type: 'directional',
            intensity: 0.3,
            color: '#ffffff',
            position: [0, 0, 200],
            name: '平行光 4',
            enabled: true,
            bindView: false
        },
        {
            type: 'directional',
            intensity: 0.4,
            color: '#ffffff',
            position: [0, 0, 200],
            name: '跟随光',
            enabled: true,
            bindView: true
        }
    ]
}

export const lightsSlice = createSlice({
    name: 'lights',
    initialState,
    reducers: {
        updateLight: (state, action) => {
            state = action.payload(state)
        },
        resetLight: () => {
            return {...initialState}
        }
    },
})

export const { updateLight, resetLight } = lightsSlice.actions
export default lightsSlice.reducer