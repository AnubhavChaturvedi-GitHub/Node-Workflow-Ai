import React, { useState, useEffect, useRef } from 'react';
import { Terminal, X, Maximize2, Minimize2 } from 'lucide-react';

export default function ActivityLogger() {
    const [logs, setLogs] = useState([]);
    const [isOpen, setIsOpen] = useState(true);
    const [isExpanded, setIsExpanded] = useState(false);
    const bottomRef = useRef(null);

    useEffect(() => {
        const ws = new WebSocket('ws://localhost:8000/ws/logs');

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                setLogs(prev => {
                    // Combine sequential LLM chunks into a single streaming block for readability
                    if (data.type === 'llm_chunk') {
                        const lastLog = prev[prev.length - 1];
                        if (lastLog && lastLog.type === 'llm_chunk') {
                            const newLogs = [...prev];
                            newLogs[newLogs.length - 1] = {
                                ...lastLog,
                                message: lastLog.message + data.message
                            };
                            return newLogs;
                        }
                    }
                    return [...prev, {
                        id: Date.now() + Math.random().toString(),
                        type: data.type,
                        message: data.message,
                        time: new Date()
                    }];
                });

            } catch (e) {
                console.error("Failed to parse log", e);
            }
        };

        return () => ws.close();
    }, []);

    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, isOpen, isExpanded]);

    if (!isOpen) {
        return (
            <div className="logger-docked" onClick={() => setIsOpen(true)}>
                <Terminal size={18} />
                <span>Live Backend Terminal</span>
                {logs.length > 0 && <span className="log-badge">{logs.length}</span>}
            </div>
        );
    }

    return (
        <div className={`logger-panel ${isExpanded ? 'expanded' : ''}`}>
            <div className="logger-header">
                <div className="logger-title">
                    <Terminal size={14} /> Live Backend Terminal
                </div>
                <div className="logger-actions">
                    <button onClick={() => setLogs([])} title="Clear Logs">Clear</button>
                    <button onClick={() => setIsExpanded(!isExpanded)}>
                        {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                    </button>
                    <button onClick={() => setIsOpen(false)}><X size={14} /></button>
                </div>
            </div>
            <div className="logger-content">
                {logs.length === 0 ? (
                    <div className="log-empty">Waiting for backend activity...</div>
                ) : (
                    logs.map((log) => (
                        <div key={log.id} className={`log-entry log-${log.type}`}>
                            <span className="log-time">{log.time.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                            <span className="log-msg">{log.message}</span>
                        </div>
                    ))
                )}
                <div ref={bottomRef} />
            </div>
        </div>
    );
}
