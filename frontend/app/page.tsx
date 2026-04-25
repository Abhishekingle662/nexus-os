'use client';

import { useEffect, useState } from 'react';
import AgentChat from '@/components/AgentChat';
import TaskList from '@/components/TaskList';

export default function NexusDashboard() {
  const [task, setTask] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const startMission = async () => {
    setIsRunning(true);
    const res = await fetch('http://localhost:8000/start-mission', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task })
    });
    // Handle response + WebSocket connection
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      <h1 className="text-5xl font-bold mb-2">Nexus<span className="text-emerald-500">OS</span></h1>
      <p className="text-zinc-400 mb-8">Multi-Agent AI Operating System</p>

      <div className="max-w-4xl mx-auto">
        <div className="bg-zinc-900 rounded-2xl p-6 mb-8">
          <input
            type="text"
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder="Describe your mission... (e.g. Build a todo app with auth)"
            className="w-full bg-zinc-800 rounded-xl px-6 py-4 text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            onClick={startMission}
            disabled={isRunning}
            className="mt-4 w-full bg-emerald-600 hover:bg-emerald-500 py-4 rounded-xl font-medium text-lg transition"
          >
            {isRunning ? "Agents Working..." : "Launch Mission"}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AgentChat logs={logs} />
          <TaskList />
        </div>
      </div>
    </div>
  );
}