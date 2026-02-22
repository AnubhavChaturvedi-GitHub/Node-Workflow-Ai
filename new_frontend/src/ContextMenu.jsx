import React, { useRef, useEffect } from 'react';
import { useReactFlow } from '@xyflow/react';

export default function ContextMenu({ mouseX, mouseY, onClick, onMouseLeave }) {
    const { screenToFlowPosition, setNodes } = useReactFlow();
    const menuRef = useRef(null);

    const addNode = (type) => {
        const position = screenToFlowPosition({ x: mouseX, y: mouseY });
        const newNode = {
            id: `dndnode_${Date.now()}`,
            type,
            position,
            data: { input: null, output: null },
        };
        setNodes((nds) => nds.concat(newNode));
        onClick();
    };

    // Close menu if clicked outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                onClick();
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [menuRef, onClick]);

    return (
        <div
            ref={menuRef}
            style={{
                top: mouseY,
                left: mouseX,
                position: 'fixed',
                zIndex: 1000,
            }}
            className="context-menu"
            onMouseLeave={onMouseLeave}
        >
            <div className="context-menu-title">Add Node Tool</div>
            <button onClick={() => addNode('textInput')}>Text Tool</button>
            <button onClick={() => addNode('llm')}>LLM Agent</button>
            <button onClick={() => addNode('image')}>Image Gen</button>
            <button onClick={() => addNode('video')}>Video Gen</button>
            <button onClick={() => addNode('preview')}>Preview Display</button>
        </div>
    );
}
