import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  addEdge,
  Background,
  Controls,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import Sidebar from './Sidebar';
import ContextMenu from './ContextMenu';
import ActivityLogger from './ActivityLogger';
import { TextInputNode, LlmNode, ImageNode, VideoNode, PreviewNode } from './components/CustomNodes';

// Register all custom tools
const nodeTypes = {
  textInput: TextInputNode,
  llm: LlmNode,
  image: ImageNode,
  video: VideoNode,
  preview: PreviewNode,
};

// Initial empty flow
const initialNodes = [];
const initialEdges = [];

let id = 0;
const getId = () => `dndnode_${id++}`;

function Flow() {
  const reactFlowWrapper = useRef(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const { screenToFlowPosition } = useReactFlow();
  const [menu, setMenu] = useState(null);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, animated: true, style: { strokeOpacity: 0.8, strokeWidth: 2, stroke: '#bf5af2' } }, eds)),
    [setEdges]
  );

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow/type');

      // Check if the dropped element is valid
      if (typeof type === 'undefined' || !type) {
        return;
      }

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode = {
        id: getId(),
        type,
        position,
        data: { input: null, output: null }, // Initialize basic data
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [screenToFlowPosition, setNodes]
  );

  // Synchronize data along edges whenever connections or node updates change
  useEffect(() => {
    setNodes((nds) => {
      const nodeMap = new Map(nds.map((n) => [n.id, n]));
      let hasChanges = false;

      edges.forEach((edge) => {
        const source = nodeMap.get(edge.source);
        const target = nodeMap.get(edge.target);

        // Pass output from source directly to input of target
        if (source && target && source.data.output !== target.data.input) {
          target.data = { ...target.data, input: source.data.output };
          hasChanges = true;
        }
      });

      return hasChanges ? [...nds] : nds;
    });
  }, [nodes, edges, setNodes]);

  const onPaneContextMenu = useCallback(
    (event) => {
      event.preventDefault();
      setMenu({
        mouseX: event.clientX,
        mouseY: event.clientY,
      });
    },
    [setMenu]
  );

  const closeMenu = useCallback(() => setMenu(null), [setMenu]);

  return (
    <div className="app-container">
      <Sidebar />
      <div className="reactflow-wrapper" ref={reactFlowWrapper} style={{ flexGrow: 1, position: 'relative' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onPaneContextMenu={onPaneContextMenu}
          onPaneClick={closeMenu}
          nodeTypes={nodeTypes}
          fitView
          className="dark"
          defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        >
          <Background color="rgba(255, 255, 255, 0.05)" gap={20} size={1} />
          <Controls />
        </ReactFlow>
        {menu && (
          <ContextMenu
            mouseX={menu.mouseX}
            mouseY={menu.mouseY}
            onClick={closeMenu}
            onMouseLeave={closeMenu}
          />
        )}
        <ActivityLogger />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <Flow />
    </ReactFlowProvider>
  );
}
