import React, { useCallback, useEffect } from 'react';
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
  Background,
  Controls,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { LlmNode, ImageNode, VideoNode } from './components/CustomNodes';

const nodeTypes = {
  llm: LlmNode,
  image: ImageNode,
  video: VideoNode,
};

const initialNodes = [
  { id: '1', type: 'llm', position: { x: 50, y: 150 }, data: { prompt: '' } },
  { id: '2', type: 'image', position: { x: 450, y: 150 }, data: { input: null } },
  { id: '3', type: 'video', position: { x: 850, y: 150 }, data: { input: null } },
];

const initialEdges = [
  { id: 'e1-2', source: '1', target: '2', animated: true, style: { strokeOpacity: 0.5, strokeWidth: 2, stroke: '#3b82f6' } },
  { id: 'e2-3', source: '2', target: '3', animated: true, style: { strokeOpacity: 0.5, strokeWidth: 2, stroke: '#ec4899' } },
];

function Flow() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  // Synchronize data along edges
  useEffect(() => {
    setNodes((nds) => {
      // Create a map for quick lookups
      const nodeMap = new Map(nds.map((n) => [n.id, n]));
      let hasChanges = false;

      // Pass down data from source output to target input
      edges.forEach((edge) => {
        const source = nodeMap.get(edge.source);
        const target = nodeMap.get(edge.target);

        if (source && target && source.data.output !== target.data.input) {
          target.data = { ...target.data, input: source.data.output };
          hasChanges = true;
        }
      });

      return hasChanges ? [...nds] : nds;
    });
  }, [nodes, edges, setNodes]);

  return (
    <div style={{ width: '100vw', height: '100vh', background: 'transparent' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        className="dark"
      >
        <Background color="rgba(255, 255, 255, 0.1)" gap={16} size={1} />
        <Controls />
      </ReactFlow>
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
