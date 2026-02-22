import React, { useRef, useEffect } from 'react';
import { useReactFlow } from '@xyflow/react';
import { Copy, Clipboard, Type, BrainCircuit, Image as ImageIcon, Film, Eye } from 'lucide-react';

const NODE_DEFS = [
    { type: 'textInput', label: 'Text Tool', icon: Type },
    { type: 'llm', label: 'LLM Agent', icon: BrainCircuit },
    { type: 'image', label: 'Image Gen', icon: ImageIcon },
    { type: 'video', label: 'Video Gen', icon: Film },
    { type: 'preview', label: 'Preview Display', icon: Eye },
];

let ctxId = 0;
const getCtxId = () => `ctx_${ctxId++}_${Date.now()}`;

export default function ContextMenu({ mouseX, mouseY, onClick, onMouseLeave, nodes, setNodes, clipboard, setClipboard }) {
    const { screenToFlowPosition } = useReactFlow();
    const menuRef = useRef(null);

    const selectedNodes = nodes?.filter(n => n.selected) || [];

    const addNode = (type) => {
        const position = screenToFlowPosition({ x: mouseX, y: mouseY });
        const newNode = {
            id: getCtxId(),
            type,
            position,
            data: { input: null, output: null },
        };
        setNodes((nds) => nds.concat(newNode));
        onClick();
    };

    const copySelected = () => {
        if (selectedNodes.length > 0) setClipboard(selectedNodes);
        onClick();
    };

    const pasteNodes = () => {
        if (!clipboard || clipboard.length === 0) return;
        const offset = { x: 40, y: 40 };
        const newNodes = clipboard.map(n => ({
            ...n,
            id: getCtxId(),
            position: { x: n.position.x + offset.x, y: n.position.y + offset.y },
            selected: false,
            data: { ...n.data },
        }));
        setNodes(nds => nds.concat(newNodes));
        onClick();
    };

    const duplicateSelected = () => {
        if (selectedNodes.length === 0) return;
        const offset = { x: 40, y: 40 };
        const newNodes = selectedNodes.map(n => ({
            ...n,
            id: getCtxId(),
            position: { x: n.position.x + offset.x, y: n.position.y + offset.y },
            selected: false,
            data: { ...n.data },
        }));
        setNodes(nds => nds.concat(newNodes));
        onClick();
    };

    // Close menu if clicked outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (menuRef.current && !menuRef.current.contains(event.target)) onClick();
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [menuRef, onClick]);

    const Divider = () => <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />;

    return (
        <div
            ref={menuRef}
            style={{ top: mouseY, left: mouseX, position: 'fixed', zIndex: 1000 }}
            className="context-menu"
            onMouseLeave={onMouseLeave}
        >
            {/* Copy / Paste / Duplicate section */}
            <div className="context-menu-title">Actions</div>
            <button onClick={copySelected} disabled={selectedNodes.length === 0} style={{ opacity: selectedNodes.length === 0 ? 0.4 : 1 }}>
                <Copy size={13} /> Copy Node{selectedNodes.length > 1 ? 's' : ''} {selectedNodes.length > 0 && `(${selectedNodes.length})`}
            </button>
            <button onClick={pasteNodes} disabled={!clipboard || clipboard.length === 0} style={{ opacity: !clipboard ? 0.4 : 1 }}>
                <Clipboard size={13} /> Paste {clipboard && `(${clipboard.length})`}
            </button>
            <button onClick={duplicateSelected} disabled={selectedNodes.length === 0} style={{ opacity: selectedNodes.length === 0 ? 0.4 : 1 }}>
                <Copy size={13} /> Duplicate
            </button>

            <Divider />

            {/* Add node section */}
            <div className="context-menu-title">Add Node</div>
            {NODE_DEFS.map(({ type, label, icon: Icon }) => (
                <button key={type} onClick={() => addNode(type)}>
                    <Icon size={13} /> {label}
                </button>
            ))}
        </div>
    );
}
