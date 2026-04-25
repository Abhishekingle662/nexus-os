'use client';

import { useEffect, useRef, useState } from 'react';

interface AgentMessage {
  type: string;
  agent?: string;
  content?: string;
  next?: string;
  task?: string;
}

export default function NexusDashboard() {
  const [task, setTask] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<AgentMessage[]>([]);
  const [currentTask, setCurrentTask] = useState('');
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000/ws');
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data: AgentMessage = JSON.parse(event.data);
      setLogs((prev) => [...prev, data]);

      if (data.type === 'mission_start') {
        setCurrentTask(data.task || '');
        setIsRunning(true);
      }
      if (data.type === 'mission_complete' || data.type === 'error') {
        setIsRunning(false);
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  const startMission = async () => {
    if (!task.trim()) return;

    setLogs([]);
    setIsRunning(true);

    const res = await fetch('http://localhost:8000/start-mission', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      setLogs((prev) => [
        ...prev,
        { type: 'error', content: `Mission failed: ${errorText}` },
      ]);
      setIsRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8 font-mono">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-6xl font-bold mb-2 tracking-tight">
          Nexus<span className="text-emerald-500">OS</span>
        </h1>
        <p className="text-zinc-500 mb-10">Multi-Agent AI Swarm - Live</p>

        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 mb-8">
          <input
            type="text"
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder='Try: "Plan a Python script that prints "Hello NexusOS""'
            className="w-full bg-zinc-950 border border-zinc-700 rounded-2xl px-6 py-5 text-lg focus:outline-none focus:border-emerald-500 transition"
            disabled={isRunning}
          />

          <button
            onClick={startMission}
            disabled={isRunning || !task.trim()}
            className="mt-4 w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 py-5 rounded-2xl font-semibold text-lg transition-all"
          >
            {isRunning ? 'Agents Working...' : 'Launch Mission'}
          </button>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 h-150 overflow-y-auto">
          <div className="flex items-center gap-3 mb-6 sticky top-0 bg-zinc-900 pb-4 border-b border-zinc-800">
            <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
            <span className="font-semibold">Live Agent Activity</span>
            {currentTask && <span className="text-emerald-400 text-sm ml-auto">-&gt; {currentTask}</span>}
          </div>

          {logs.length === 0 && (
            <div className="text-zinc-500 italic text-center py-20">
              Launch a mission to see agents thinking in real time...
            </div>
          )}

          {logs.map((log, i) => (
            <div key={i} className="mb-6 border-l-2 border-zinc-700 pl-4">
              {log.type === 'mission_start' && (
                <div className="text-emerald-400 font-medium">Mission Started</div>
              )}
              {log.agent && (
                <div className="text-sm uppercase tracking-widest text-zinc-500 mb-1">
                  {log.agent.toUpperCase()} AGENT
                </div>
              )}
              <div className="text-zinc-300 leading-relaxed whitespace-pre-wrap">
                {log.content || ''}
              </div>
              {log.next && log.next !== 'END' && (
                <div className="text-xs text-amber-400 mt-2">-&gt; Next: {log.next}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}