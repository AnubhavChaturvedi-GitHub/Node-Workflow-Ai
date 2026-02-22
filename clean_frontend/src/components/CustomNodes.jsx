import React, { useState, useEffect } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { NodeResizer } from '@xyflow/react';
import { Type, BrainCircuit, Image as ImageIcon, Film, Play, Loader2, Eye, X } from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = 'http://localhost:8000';

function NodeDeleteBtn({ id }) {
    const { deleteElements } = useReactFlow();
    return (
        <div
            className="node-delete-btn"
            onClick={(e) => {
                e.stopPropagation();
                deleteElements({ nodes: [{ id }] });
            }}
            title="Delete Node"
        >
            <X size={14} strokeWidth={3} />
        </div>
    );
}

// ----------------------------------------------------------------------------
// 1. Text Input Node (Start of a pipeline)
// ----------------------------------------------------------------------------
export function TextInputNode({ id, data, selected }) {
    const { updateNodeData } = useReactFlow();
    const [text, setText] = useState(data.input || '');

    // Constantly push output so downstream notes react as you type
    useEffect(() => {
        updateNodeData(id, { output: text });
    }, [text, id, updateNodeData]);

    return (
        <div className={`custom-node ${selected ? 'selected' : ''}`} style={{ width: '100%', height: '100%', minWidth: 250, minHeight: 150 }}>
            <NodeDeleteBtn id={id} />
            <NodeResizer color="#bf5af2" isVisible={selected} minWidth={250} minHeight={150} />
            <div className="node-header">
                <div className="node-icon-wrapper" style={{ boxShadow: 'none' }}>
                    <Type size={20} color="#a1a1aa" />
                </div>
                <div>
                    <div className="node-title">Text Tool</div>
                    <div className="node-subtitle">Write your base prompt</div>
                </div>
            </div>
            <div className="node-content nodrag" style={{ height: 'calc(100% - 70px)' }}>
                <textarea
                    className="node-textarea nodrag"
                    style={{ height: '100%' }}
                    placeholder="Enter explicit instructions or ideas..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                />
            </div>
            <Handle type="source" position={Position.Right} className="react-flow__handle-right" />
        </div>
    );
}

// ----------------------------------------------------------------------------
// 2. LLM Node (Processes text)
// ----------------------------------------------------------------------------
export function LlmNode({ id, data, selected }) {
    const [isLoading, setIsLoading] = useState(false);
    const { updateNodeData } = useReactFlow();

    const handleGenerate = async () => {
        if (!data.input) return;
        setIsLoading(true);
        updateNodeData(id, { error: null });
        try {
            const res = await axios.post(`${BACKEND_URL}/api/llm`, { prompt: data.input });
            const enhanced = res.data.enhanced_prompt;
            updateNodeData(id, { output: enhanced });
        } catch (e) {
            console.error(e);
            const errDetail = e.response?.data?.detail || 'Failed to connect to backend';
            updateNodeData(id, { error: errDetail });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={`custom-node ${selected ? 'selected' : ''}`} style={{ width: '100%', height: '100%', minWidth: 280, minHeight: 180 }}>
            <NodeDeleteBtn id={id} />
            <NodeResizer color="#bf5af2" isVisible={selected} minWidth={280} minHeight={180} />
            <Handle type="target" position={Position.Left} className="react-flow__handle-left" />

            <div className="node-header">
                <div className="node-icon-wrapper">
                    <BrainCircuit className="icon-llm" size={20} />
                </div>
                <div>
                    <div className="node-title">LLM Agent</div>
                    <div className="node-subtitle">Idea Expander (Groq API)</div>
                </div>
            </div>

            <div className="node-content nodrag" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100% - 70px)' }}>
                <div className="status-indicator" style={{ flexShirnk: 0 }}>
                    {data.input ? '✅ Has up-stream Prompt' : '⏳ Connect upstream text node...'}
                </div>
                <button className="node-btn nodrag" onClick={handleGenerate} disabled={!data.input || isLoading} style={{ flexShrink: 0 }}>
                    {isLoading ? <Loader2 className="spinner" size={16} /> : <Play size={16} />}
                    {isLoading ? 'Enhancing...' : 'Process Text'}
                </button>
                {data.error && (
                    <div className="status-indicator" style={{ color: '#ff3b30' }}>
                        ❌ Error: {data.error}
                    </div>
                )}
                {data.output && !data.error && (
                    <div className="result-container" style={{ flexGrow: 1, overflow: 'auto' }}>
                        {data.output}
                    </div>
                )}
            </div>

            <Handle type="source" position={Position.Right} className="react-flow__handle-right" />
        </div>
    );
}

// ----------------------------------------------------------------------------
// 3. Image Gen Node
// ----------------------------------------------------------------------------
export function ImageNode({ id, data, selected }) {
    const [isLoading, setIsLoading] = useState(false);
    const { updateNodeData } = useReactFlow();

    const handleGenerate = async () => {
        if (!data.input) return;
        setIsLoading(true);
        updateNodeData(id, { error: null });
        try {
            // Depending on upstream, data.input might be a long generated string
            const res = await axios.post(`${BACKEND_URL}/api/generate-image`, { prompt: data.input });
            updateNodeData(id, { output: res.data.image_url });
        } catch (e) {
            console.error(e);
            const errDetail = e.response?.data?.detail || 'Image generation failed';
            updateNodeData(id, { error: errDetail });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={`custom-node ${selected ? 'selected' : ''}`} style={{ width: '100%', height: '100%', minWidth: 280, minHeight: 150 }}>
            <NodeDeleteBtn id={id} />
            <NodeResizer color="#ff2d55" isVisible={selected} minWidth={280} minHeight={150} />
            <Handle type="target" position={Position.Left} className="react-flow__handle-left" />

            <div className="node-header" style={{ marginBottom: 12 }}>
                <div className="node-icon-wrapper">
                    <ImageIcon className="icon-image" size={20} />
                </div>
                <div>
                    <div className="node-title">Image Generator</div>
                    <div className="node-subtitle">Playwright Whisk Bot</div>
                </div>
            </div>

            <div className="node-content nodrag">
                <button className="node-btn nodrag" onClick={handleGenerate} disabled={!data.input || isLoading}>
                    {isLoading ? <Loader2 className="spinner" size={16} /> : <Play size={16} />}
                    {isLoading ? 'Automating UI...' : 'Generate Canvas Image'}
                </button>
                <div className="status-indicator">
                    {data.error ? <span style={{ color: '#ff3b30' }}>❌ {data.error}</span> :
                        (data.output ? '' : (data.input ? '✅ Ready to gen' : '⏳ No Input'))
                    }
                </div>
                {data.output && !data.error && (
                    <div className="result-container" style={{ flexGrow: 1, overflow: 'hidden', padding: 0, marginTop: 8 }}>
                        <img src={data.output} alt="Generated UI" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '6px' }} />
                    </div>
                )}
            </div>

            <Handle type="source" position={Position.Right} className="react-flow__handle-right" />
        </div>
    );
}

// ----------------------------------------------------------------------------
// 4. Video Gen Node
// ----------------------------------------------------------------------------
export function VideoNode({ id, data, selected }) {
    const [isLoading, setIsLoading] = useState(false);
    const { updateNodeData } = useReactFlow();

    const handleGenerate = async () => {
        if (!data.input) return;
        setIsLoading(true);
        updateNodeData(id, { error: null });
        try {
            // Data input expected to be image_url from Image node
            const res = await axios.post(`${BACKEND_URL}/api/generate-video`, { image_url: data.input });
            updateNodeData(id, { output: res.data.video_url });
        } catch (e) {
            console.error(e);
            const errDetail = e.response?.data?.detail || 'Video generation failed';
            updateNodeData(id, { error: errDetail });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={`custom-node ${selected ? 'selected' : ''}`} style={{ width: '100%', height: '100%', minWidth: 280, minHeight: 150 }}>
            <NodeDeleteBtn id={id} />
            <NodeResizer color="#5e5ce6" isVisible={selected} minWidth={280} minHeight={150} />
            <Handle type="target" position={Position.Left} className="react-flow__handle-left" />

            <div className="node-header" style={{ marginBottom: 12 }}>
                <div className="node-icon-wrapper">
                    <Film className="icon-video" size={20} />
                </div>
                <div>
                    <div className="node-title">Video Generator</div>
                    <div className="node-subtitle">Grok Playwright Bot</div>
                </div>
            </div>

            <div className="node-content nodrag">
                <button className="node-btn nodrag" onClick={handleGenerate} disabled={!data.input || isLoading}>
                    {isLoading ? <Loader2 className="spinner" size={16} /> : <Play size={16} />}
                    {isLoading ? 'Rendering Video...' : 'Generate Explainer Video'}
                </button>
                <div className="status-indicator">
                    {data.error ? <span style={{ color: '#ff3b30' }}>❌ {data.error}</span> :
                        (data.output ? '' : (data.input ? '✅ Image source linked' : '⏳ Waiting for image url...'))
                    }
                </div>
                {data.output && !data.error && (
                    <div className="result-container" style={{ flexGrow: 1, overflow: 'hidden', padding: 0, marginTop: 8 }}>
                        <video src={data.output} autoPlay loop controls style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '6px', background: '#000' }} />
                    </div>
                )}
            </div>

            <Handle type="source" position={Position.Right} className="react-flow__handle-right" />
        </div>
    );
}

// ----------------------------------------------------------------------------
// 5. Preview Display Node — Multi-image gallery support
// ----------------------------------------------------------------------------
export function PreviewNode({ id, data, selected }) {
    const [lightboxSrc, setLightboxSrc] = React.useState(null);

    // Split combined inputs on double-newline separator used by App.jsx
    const items = data.input
        ? data.input.split(/\\n\\n|\n\n/).map(s => s.trim()).filter(Boolean)
        : [];

    const getItemType = (item) => {
        if (!item) return 'text';
        if (item.endsWith('.mp4') || item.endsWith('.webm')) return 'video';
        if (item.startsWith('http') || item.startsWith('/') || item.startsWith('data:image')) return 'image';
        return 'text';
    };

    return (
        <div className={`custom-node ${selected ? 'selected' : ''}`} style={{ width: '100%', height: '100%', minWidth: 320, minHeight: 320 }}>
            <NodeDeleteBtn id={id} />
            <NodeResizer color="#34c759" isVisible={selected} minWidth={200} minHeight={200} />
            <Handle type="target" position={Position.Left} className="react-flow__handle-left" />

            <div className="node-header" style={{ borderBottom: 'none', marginBottom: 0 }}>
                <div className="node-icon-wrapper">
                    <Eye size={20} color="#34c759" />
                </div>
                <div>
                    <div className="node-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        Live Preview
                        {items.length > 1 && (
                            <span style={{ background: '#34c759', color: '#000', borderRadius: '12px', padding: '1px 8px', fontSize: '11px', fontWeight: 700 }}>
                                {items.length}
                            </span>
                        )}
                    </div>
                    <div className="node-subtitle">Wire media output here</div>
                </div>
            </div>

            <div className="node-content nodrag" style={{ height: 'calc(100% - 60px)', overflowY: 'auto' }}>
                {/* Empty state */}
                {items.length === 0 && (
                    <div className="result-container nodrag" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                        Connect upstream media...
                    </div>
                )}

                {/* Multiple items — gallery grid */}
                {items.length > 1 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, padding: 4 }}>
                        {items.map((item, i) => {
                            const type = getItemType(item);
                            return (
                                <div key={i} style={{ borderRadius: 8, overflow: 'hidden', background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.08)', cursor: type === 'image' ? 'zoom-in' : 'default' }}>
                                    {type === 'image' && (
                                        <img
                                            src={item}
                                            alt={`Preview ${i + 1}`}
                                            onClick={() => setLightboxSrc(item)}
                                            style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }}
                                        />
                                    )}
                                    {type === 'video' && (
                                        <video src={item} controls style={{ width: '100%', display: 'block' }} />
                                    )}
                                    {type === 'text' && (
                                        <div style={{ padding: 8, fontSize: 11, color: '#aaa', maxHeight: 120, overflowY: 'auto' }}>{item}</div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Single item — full size */}
                {items.length === 1 && (() => {
                    const item = items[0];
                    const type = getItemType(item);
                    return (
                        <>
                            {type === 'image' && (
                                <img
                                    src={item}
                                    alt="Preview"
                                    onClick={() => setLightboxSrc(item)}
                                    style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '8px', cursor: 'zoom-in' }}
                                />
                            )}
                            {type === 'video' && (
                                <video src={item} controls autoPlay loop style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '8px', background: '#000' }} />
                            )}
                            {type === 'text' && (
                                <div className="result-container" style={{ height: '100%' }}>{item}</div>
                            )}
                        </>
                    );
                })()}
            </div>

            {/* Lightbox for fullscreen image view */}
            {lightboxSrc && (
                <div
                    onClick={() => setLightboxSrc(null)}
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}
                >
                    <img src={lightboxSrc} alt="Full Preview" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 12, boxShadow: '0 0 80px rgba(0,0,0,0.9)' }} />
                    <div style={{ position: 'absolute', top: 20, right: 24, color: '#fff', fontSize: 28, cursor: 'pointer', opacity: 0.7 }}>✕</div>
                </div>
            )}
        </div>
    );
}
