import React, { useState, useEffect } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { BrainCircuit, Image as ImageIcon, Film, Play, Loader2 } from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = 'http://localhost:8000';

export function LlmNode({ id, data }) {
    const [prompt, setPrompt] = useState(data.prompt || '');
    const [isLoading, setIsLoading] = useState(false);
    const { updateNodeData } = useReactFlow();

    const handleGenerate = async () => {
        setIsLoading(true);
        try {
            const res = await axios.post(`${BACKEND_URL}/api/llm`, { prompt });
            const enhanced = res.data.enhanced_prompt;
            updateNodeData(id, { output: enhanced });
        } catch (e) {
            console.error(e);
            updateNodeData(id, { error: 'Failed to generate prompt' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={`custom-node ${data.selected ? 'selected' : ''}`}>
            <div className="node-header">
                <div className="node-icon-wrapper">
                    <BrainCircuit className="icon-llm" size={20} />
                </div>
                <div>
                    <div className="node-title">LLM Agent</div>
                    <div className="node-subtitle">Idea Expander</div>
                </div>
            </div>
            <div className="node-content">
                <textarea
                    className="node-textarea"
                    placeholder="Enter your base idea (e.g. A futuristic city)..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                />
                <button className="node-btn" onClick={handleGenerate} disabled={!prompt || isLoading}>
                    {isLoading ? <Loader2 className="spinner" size={16} /> : <Play size={16} />}
                    {isLoading ? 'Enhancing...' : 'Enhance Prompt'}
                </button>
                {data.output && (
                    <div className="result-container">
                        <strong>Enhanced Prompt:</strong> {data.output}
                    </div>
                )}
            </div>
            <Handle type="source" position={Position.Right} className="react-flow__handle-right" />
        </div>
    );
}

export function ImageNode({ id, data }) {
    const [isLoading, setIsLoading] = useState(false);
    const { updateNodeData } = useReactFlow();

    const handleGenerate = async () => {
        setIsLoading(true);
        try {
            const res = await axios.post(`${BACKEND_URL}/api/generate-image`, { prompt: data.input });
            updateNodeData(id, { output: res.data.image_url });
        } catch (e) {
            console.error(e);
            updateNodeData(id, { error: 'Failed to generate image' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={`custom-node ${data.selected ? 'selected' : ''}`}>
            <Handle type="target" position={Position.Left} className="react-flow__handle-left" />
            <div className="node-header">
                <div className="node-icon-wrapper">
                    <ImageIcon className="icon-image" size={20} />
                </div>
                <div>
                    <div className="node-title">Image Generator</div>
                    <div className="node-subtitle">Playwright Whisk Bot</div>
                </div>
            </div>
            <div className="node-content">
                <div className="status-indicator">
                    {data.input ? '✅ Prompt received' : '⏳ Waiting for prompt...'}
                </div>
                <button className="node-btn" onClick={handleGenerate} disabled={!data.input || isLoading}>
                    {isLoading ? <Loader2 className="spinner" size={16} /> : <Play size={16} />}
                    {isLoading ? 'Automating UI...' : 'Generate Image'}
                </button>
                {data.output && (
                    <div>
                        <img src={data.output} alt="Generated" className="result-image" />
                    </div>
                )}
            </div>
            <Handle type="source" position={Position.Right} className="react-flow__handle-right" />
        </div>
    );
}

export function VideoNode({ id, data }) {
    const [isLoading, setIsLoading] = useState(false);
    const { updateNodeData } = useReactFlow();

    const handleGenerate = async () => {
        setIsLoading(true);
        try {
            const res = await axios.post(`${BACKEND_URL}/api/generate-video`, { image_url: data.input });
            updateNodeData(id, { output: res.data.video_url });
        } catch (e) {
            console.error(e);
            updateNodeData(id, { error: 'Failed to generate video' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={`custom-node ${data.selected ? 'selected' : ''}`}>
            <Handle type="target" position={Position.Left} className="react-flow__handle-left" />
            <div className="node-header">
                <div className="node-icon-wrapper">
                    <Film className="icon-video" size={20} />
                </div>
                <div>
                    <div className="node-title">Video Generator</div>
                    <div className="node-subtitle">Animation Node</div>
                </div>
            </div>
            <div className="node-content">
                <div className="status-indicator">
                    {data.input ? '✅ Image received' : '⏳ Waiting for image...'}
                </div>
                <button className="node-btn" onClick={handleGenerate} disabled={!data.input || isLoading}>
                    {isLoading ? <Loader2 className="spinner" size={16} /> : <Play size={16} />}
                    {isLoading ? 'Rendering...' : 'Generate Video'}
                </button>
                {data.output && (
                    <div className="result-container">
                        ✅ Video Complete: {data.output}
                        <br />
                        <br />
                        <span style={{ color: 'var(--accent-blue)' }}>Pipeline Finished!</span>
                    </div>
                )}
            </div>
        </div>
    );
}
