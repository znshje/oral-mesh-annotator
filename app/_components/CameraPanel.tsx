'use client'

import {Button} from "antd";
import {useAppDispatch} from "@/lib/hooks";
import {resetCamera} from "@/lib/features/history/historySlice";

const CameraPanel: React.FC = () => {
    const dispatch = useAppDispatch()

    return <div>
        <Button block onClick={() => dispatch(resetCamera())}>重置</Button>
    </div>
}

export default CameraPanel