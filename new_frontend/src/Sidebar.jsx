import React from 'react';
import { Type, BrainCircuit, Image as ImageIcon, Film, Eye } from 'lucide-react';

export default function Sidebar() {
    const onDragStart = (event, nodeType, label) => {
        event.dataTransfer.setData('application/reactflow/type', nodeType);
        event.dataTransfer.setData('application/reactflow/label', label);
        event.dataTransfer.effectAllowed = 'move';
    };

    return (
        <aside className="sidebar">
            <div className="sidebar-title">Tool Options</div>

            <div className="tool-list">
                <div
                    className="tool-item"
                    onDragStart={(event) => onDragStart(event, 'textInput', 'Text Prompter')}
                    draggable
                >
                    <Type size={18} />
                    <span>Text Tool</span>
                </div>

                <div
                    className="tool-item llm-tool"
                    onDragStart={(event) => onDragStart(event, 'llm', 'LLM Agent')}
                    draggable
                >
                    <BrainCircuit size={18} />
                    <span>LLM Tool</span>
                </div>

                <div
                    className="tool-item image-tool"
                    onDragStart={(event) => onDragStart(event, 'image', 'Image Gen')}
                    draggable
                >
                    <ImageIcon size={18} />
                    <span>Image Tool</span>
                </div>

                <div
                    className="tool-item video-tool"
                    onDragStart={(event) => onDragStart(event, 'video', 'Video Gen')}
                    draggable
                >
                    <Film size={18} />
                    <span>Video Tool</span>
                </div>

                <div
                    className="tool-item preview-tool"
                    onDragStart={(event) => onDragStart(event, 'preview', 'Preview Output')}
                    draggable
                >
                    <Eye size={18} />
                    <span>Preview Display</span>
                </div>
            </div>
        </aside>
    );
}
