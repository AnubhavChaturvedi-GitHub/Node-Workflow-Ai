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
import axios from 'axios';
import { Play, Loader2 } from 'lucide-react';

import Sidebar from './Sidebar';
import ContextMenu from './ContextMenu';
import ActivityLogger from './ActivityLogger';
import { TextInputNode, LlmNode, ImageNode, VideoNode, PreviewNode } from './components/CustomNodes';

const BACKEND_URL = 'http://localhost:8000';

// Register all custom tools
const nodeTypes = {
  textInput: TextInputNode,
  llm: LlmNode,
  image: ImageNode,
  video: VideoNode,
  preview: PreviewNode,
};

const initialNodes = [];
const initialEdges = [];

let id = 0;
const getId = () => `dndnode_${id++}`;

// Topological level grouping — returns array of levels, each level is an array of node IDs
function topoLevels(nodes, edges) {
  const inDegree = new Map(nodes.map(n => [n.id, 0]));
  const children = new Map(nodes.map(n => [n.id, []]));

  edges.forEach(e => {
    inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
    children.get(e.source)?.push(e.target);
  });

  const levels = [];
  let current = nodes.filter(n => (inDegree.get(n.id) || 0) === 0).map(n => n.id);

  while (current.length > 0) {
    levels.push(current);
    const next = [];
    current.forEach(id => {
      (children.get(id) || []).forEach(childId => {
        inDegree.set(childId, (inDegree.get(childId) || 0) - 1);
        if (inDegree.get(childId) === 0) next.push(childId);
      });
    });
    current = next;
  }

  return levels; // Each level can run in parallel
}

function Flow() {
  const reactFlowWrapper = useRef(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const { screenToFlowPosition } = useReactFlow();
  const [menu, setMenu] = useState(null);
  const [isPipelineRunning, setIsPipelineRunning] = useState(false);
  const [clipboard, setClipboard] = useState(null); // copied node(s)

  const onConnect = useCallback(
    (params) => {
      setEdges((eds) => addEdge({ ...params, animated: true, style: { strokeOpacity: 0.8, strokeWidth: 2, stroke: '#bf5af2' } }, eds));
      setNodes((nds) => {
        const sourceNode = nds.find(n => n.id === params.source);
        if (sourceNode && sourceNode.data.output) {
          return nds.map((n) => {
            if (n.id === params.target) {
              const currentInput = n.data.input;
              const newInput = currentInput ? currentInput + "\\n\\n" + sourceNode.data.output : sourceNode.data.output;
              return { ...n, data: { ...n.data, input: newInput } };
            }
            return n;
          });
        }
        return nds;
      });
    },
    [setEdges, setNodes]
  );

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow/type');
      if (!type) return;
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      setNodes((nds) => nds.concat({ id: getId(), type, position, data: { input: null, output: null } }));
    },
    [screenToFlowPosition, setNodes]
  );

  // Sync edge data downstream when outputs change
  const nodeOutputsAndEdgesStr = JSON.stringify({
    outputs: nodes.map(n => ({ id: n.id, output: n.data.output })),
    edges: edges.map(e => ({ source: e.source, target: e.target }))
  });

  useEffect(() => {
    setNodes((nds) => {
      const nodeMap = new Map(nds.map((n) => [n.id, n]));
      let hasChanges = false;
      const targetInputs = {};

      edges.forEach((edge) => {
        const source = nodeMap.get(edge.source);
        if (source && source.data.output) {
          if (!targetInputs[edge.target]) targetInputs[edge.target] = [];
          targetInputs[edge.target].push(source.data.output);
        }
      });

      const newNodes = nds.map((n) => {
        const inputs = targetInputs[n.id];
        const newInput = inputs ? inputs.join("\\n\\n") : null;
        if (n.data.input !== newInput) {
          hasChanges = true;
          return { ...n, data: { ...n.data, input: newInput } };
        }
        return n;
      });

      return hasChanges ? newNodes : nds;
    });
  }, [nodeOutputsAndEdgesStr, setNodes]);

  // Keyboard copy-paste: Ctrl+C / Ctrl+V
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
        setNodes(nds => {
          const selected = nds.filter(n => n.selected);
          if (selected.length > 0) setClipboard(selected);
          return nds;
        });
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
        if (!clipboard) return;
        const offset = { x: 40, y: 40 };
        const newNodes = clipboard.map(n => ({
          ...n,
          id: getId(),
          position: { x: n.position.x + offset.x, y: n.position.y + offset.y },
          selected: false,
          data: { ...n.data }, // preserve content
        }));
        setNodes(nds => nds.concat(newNodes));
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [clipboard, setNodes]);

  // ----------------------------------------------------------------------------
  // Run All Pipeline — executes nodes level-by-level, parallel within each level
  // ----------------------------------------------------------------------------
  const runPipeline = useCallback(async () => {
    setIsPipelineRunning(true);

    // Snapshot nodes
    let currentNodes = [];
    setNodes(nds => { currentNodes = nds; return nds; });
    await new Promise(r => setTimeout(r, 50));
    setNodes(nds => { currentNodes = nds; return nds; });

    const getLatestNode = (id) => new Promise(resolve => {
      setNodes(nds => { resolve(nds.find(n => n.id === id)); return nds; });
    });

    const updateOutput = (id, output) => {
      setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, output, _running: false } } : n));
    };

    const setRunning = (id, running) => {
      setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, _running: running } } : n));
    };

    const processNode = async (nodeId) => {
      const node = await getLatestNode(nodeId);
      if (!node) return;
      const input = node.data.input;

      // Wait a tick so downstream sync effects settle after parent node output updates
      await new Promise(r => setTimeout(r, 150));
      const refreshed = await getLatestNode(nodeId);
      const refreshedInput = refreshed?.data?.input || input;

      try {
        if (node.type === 'llm' && refreshedInput) {
          setRunning(nodeId, true);
          const res = await axios.post(`${BACKEND_URL}/api/llm`, { prompt: refreshedInput });
          updateOutput(nodeId, res.data.enhanced_prompt);

        } else if (node.type === 'image' && refreshedInput) {
          setRunning(nodeId, true);
          const res = await axios.post(`${BACKEND_URL}/api/generate-image`, { prompt: refreshedInput });
          updateOutput(nodeId, res.data.image_url);

        } else if (node.type === 'video' && refreshedInput) {
          setRunning(nodeId, true);
          const res = await axios.post(`${BACKEND_URL}/api/generate-video`, { image_url: refreshedInput });
          updateOutput(nodeId, res.data.video_url);
        }
      } catch (e) {
        const err = e.response?.data?.detail || e.message;
        setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, error: err, _running: false } } : n));
      }
    };

    const levels = topoLevels(currentNodes, edges);

    for (const level of levels) {
      // Run all nodes at this level in parallel
      await Promise.all(level.map(nodeId => processNode(nodeId)));
      // Small gap between levels so sync effects propagate
      await new Promise(r => setTimeout(r, 300));
    }

    setIsPipelineRunning(false);
  }, [edges, setNodes]);

  const onPaneContextMenu = useCallback(
    (event) => {
      event.preventDefault();
      setMenu({ mouseX: event.clientX, mouseY: event.clientY });
    },
    [setMenu]
  );

  const closeMenu = useCallback(() => setMenu(null), [setMenu]);

  return (
    <div className="app-container">
      <Sidebar />
      <div className="reactflow-wrapper" ref={reactFlowWrapper} style={{ flexGrow: 1, position: 'relative' }}>
        {/* Run All Toolbar */}
        <div style={{
          position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
          zIndex: 10, display: 'flex', alignItems: 'center', gap: 10,
          background: 'rgba(20, 20, 35, 0.85)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.12)', borderRadius: 32,
          padding: '8px 20px', boxShadow: '0 4px 24px rgba(0,0,0,0.4)'
        }}>
          <span style={{ color: '#a1a1aa', fontSize: 13, fontWeight: 500, letterSpacing: '0.02em' }}>
            Pipeline
          </span>
          <button
            onClick={runPipeline}
            disabled={isPipelineRunning}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: isPipelineRunning ? 'rgba(191,90,242,0.3)' : 'linear-gradient(135deg, #bf5af2, #9747ff)',
              border: 'none', borderRadius: 20, padding: '7px 18px',
              color: '#fff', fontSize: 13, fontWeight: 600, cursor: isPipelineRunning ? 'not-allowed' : 'pointer',
              boxShadow: isPipelineRunning ? 'none' : '0 0 16px rgba(191,90,242,0.5)',
              transition: 'all 0.2s ease'
            }}
          >
            {isPipelineRunning
              ? <><Loader2 size={14} className="spinner" /> Running...</>
              : <><Play size={14} fill="#fff" /> Run All</>
            }
          </button>
        </div>

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
            nodes={nodes}
            setNodes={setNodes}
            clipboard={clipboard}
            setClipboard={setClipboard}
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
