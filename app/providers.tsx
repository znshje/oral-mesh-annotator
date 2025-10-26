'use client'

import '@ant-design/v5-patch-for-react-19';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import {useEffect, useState} from "react";
import {AppStore, makeStore} from "@/lib/store";
import {Provider as ReduxProvider} from "react-redux";
import {Spin} from "antd";

interface ProvidersProps {
    children: React.ReactNode
}

const StoreProvider = ({children}: ProvidersProps) => {
    // const storeRef = useRef<AppStore | null>(null)
    // if (!storeRef.current) {
    //     storeRef.current = makeStore()
    // }
    // return <ReduxProvider store={storeRef.current}>
    //     {children}
    // </ReduxProvider>
    const [store, setStore] = useState<AppStore | null>(null);

    useEffect(() => {
        (async () => {
            const s = await makeStore();
            setStore(s);
        })();
    }, []);

    if (!store) {
        return <Spin fullscreen spinning />; // 你可以改成 skeleton/空页面
    }

    return <ReduxProvider store={store}>{children}</ReduxProvider>;
}

export function Providers({children}: ProvidersProps) {
    return <StoreProvider>
        <AntdRegistry>
            {children}
        </AntdRegistry>
    </StoreProvider>
}