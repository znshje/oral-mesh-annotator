'use client'

import {Splitter} from "antd";
import FileSelector from "@/app/_components/FileSelector";
import ModelRenderer from "@/app/_components/ModelRenderer";
import LabelsPanel from "./_components/LabelsPanel";

const App: React.FC = () => {

    return <Splitter lazy style={{width: '100vw', height: '100vh'}} layout="vertical">
        <Splitter.Panel resizable={false} defaultSize={64}>
            <FileSelector />
        </Splitter.Panel>
        <Splitter.Panel>
            <Splitter lazy layout="horizontal">
                <Splitter.Panel defaultSize="30%" min={200}>
                    <LabelsPanel />
                </Splitter.Panel>
                <Splitter.Panel defaultSize="70%" min={400}>
                    <ModelRenderer />
                </Splitter.Panel>
            </Splitter>
        </Splitter.Panel>
    </Splitter>
}

export default App;