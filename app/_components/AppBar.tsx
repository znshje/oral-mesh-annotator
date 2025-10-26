'use client'

import {Segmented} from "antd";
import {useAppDispatch, useAppSelector} from "@/lib/hooks";
import {RootState} from "@/lib/store";
import {setState} from "@/lib/features/controls/controlsSlice";

const SEGMENTED_ITEMS = ['工作目录', '渲染编排', '渲染选项', '输出']

const AppBar: React.FC = () => {
    const {tabIndex} = useAppSelector((state: RootState) => state.controls.ui);
    const dispatch = useAppDispatch();

    return <div style={{height: '100%', display: 'flex', alignItems: 'center', padding: '0 16px'}}>
        <Segmented size="large" value={SEGMENTED_ITEMS[tabIndex]} options={SEGMENTED_ITEMS} onChange={key => dispatch(setState(state => state.ui.tabIndex = '' + SEGMENTED_ITEMS.indexOf(key)))} />
    </div>
}

export default AppBar;