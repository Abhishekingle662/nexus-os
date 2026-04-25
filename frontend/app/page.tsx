'use client';

import { useEffect, useState, useRef } from 'react';

interface AgentMessage {
  type: string;
  agent?: string;
  content: string;
  next?: string;
  task?: string;
}

interface GeneratedFile {
  filename: string;
  content: string;
}

export default function NexusDashboard() {
  const [task, setTask] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<AgentMessage[]>([]);
  const [currentTask, setCurrentTask] = useState("");
  const [wsConnected, setWsConnected] = useState(false);
  const [files, setFiles] = useState<GeneratedFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<GeneratedFile | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const logsEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let destroyed = false;
    let retryTimer: ReturnType<typeof setTimeout>;

    function open() {
      if (destroyed) return;
      const ws = new WebSocket('ws://localhost:8000/ws');
      wsRef.current = ws;

      ws.onopen = () => { if (!destroyed) setWsConnected(true); };

      ws.onmessage = (event) => {
        if (destroyed) return;
        const data: AgentMessage = JSON.parse(event.data);
        setLogs(prev => [...prev, data]);
        if (data.type === "mission_start") { setCurrentTask(data.task || ""); setIsRunning(true); }
        if (data.type === "mission_complete") { setIsRunning(false); fetchFiles(); }
        if (data.type === "error") setIsRunning(false);
      };

      ws.onclose = () => {
        if (destroyed) return;
        setWsConnected(false);
        retryTimer = setTimeout(open, 3000);
      };

      ws.onerror = () => ws.close();
    }

    open();
    fetchFiles();

    return () => {
      destroyed = true;
      clearTimeout(retryTimer);
      wsRef.current?.close();
    };
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const fetchFiles = async () => {
    try {
      const res = await fetch('http://localhost:8000/files');
      const data = await res.json();
      const loaded: GeneratedFile[] = await Promise.all(
        data.files.map(async (name: string) => {
          const r = await fetch(`http://localhost:8000/files/${name}`);
          return r.json();
        })
      );
      setFiles(loaded);
      if (loaded.length > 0) setSelectedFile(loaded[loaded.length - 1]);
    } catch {}
  };

  const startMission = async () => {
    if (!task.trim() || isRunning) return;
    setLogs([]);
    setIsRunning(true);
    try {
      await fetch('http://localhost:8000/start-mission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task }),
      });
    } catch {
      setIsRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8 font-mono">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-6xl font-bold tracking-tight">
            Nexus<span className="text-emerald-500">OS</span>
          </h1>
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} />
            <span>{wsConnected ? 'Connected' : 'Reconnecting...'}</span>
          </div>
        </div>
        <p className="text-zinc-500 mb-8">GPT-4o Mini • Agent Swarm</p>

        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 mb-6">
          <input
            type="text"
            value={task}
            onChange={(e) => setTask(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && startMission()}
            placeholder='Try: "Build a Python script that fetches weather data"'
            className="w-full bg-zinc-950 border border-zinc-700 rounded-2xl px-6 py-5 text-lg focus:outline-none focus:border-emerald-500 transition"
            disabled={isRunning}
          />
          <button
            onClick={startMission}
            disabled={isRunning || !task.trim() || !wsConnected}
            className="mt-4 w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:cursor-not-allowed py-5 rounded-2xl font-semibold text-lg transition-all flex items-center justify-center gap-3"
          >
            {isRunning ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent animate-spin rounded-full" />
                <span>Agents Working...</span>
              </>
            ) : 'Launch Mission'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Live Agent Activity */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 h-155 overflow-y-auto">
            <div className="flex items-center gap-3 mb-6 sticky top-0 bg-zinc-900 pb-4 border-b border-zinc-800">
              <div className={`w-3 h-3 rounded-full ${isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-500'}`} />
              <span className="font-semibold">Live Agent Activity</span>
              {currentTask && <span className="text-emerald-400 text-xs ml-auto truncate max-w-xs">→ {currentTask}</span>}
            </div>

            {!isRunning && logs.length === 0 && (
              <div className="flex flex-col items-center justify-center h-96 text-center text-zinc-600">
                <p className="text-lg">No missions yet.</p>
                <p className="text-sm mt-2">Enter a task above and launch a mission.</p>
              </div>
            )}

            {isRunning && logs.length === 0 && (
              <div className="flex flex-col items-center justify-center h-96 text-center">
                <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent animate-spin rounded-full mb-6" />
                <p className="text-emerald-400 text-xl font-medium">Agents are thinking...</p>
                <p className="text-zinc-500 mt-3">GPT-4o Mini is processing your mission.</p>
              </div>
            )}

            {logs.map((log, i) => (
              <div key={i} className={`mb-6 border-l-2 pl-4 ${
                log.type === 'error' ? 'border-red-500' :
                log.type === 'mission_complete' ? 'border-emerald-500' :
                'border-zinc-700'
              }`}>
                {log.agent && (
                  <div className="text-xs uppercase tracking-widest text-zinc-400 mb-1">{log.agent} Agent</div>
                )}
                <div className={`leading-relaxed whitespace-pre-wrap text-sm ${
                  log.type === 'error' ? 'text-red-400' :
                  log.type === 'mission_complete' ? 'text-emerald-400' :
                  'text-zinc-300'
                }`}>
                  {log.content}
                </div>
                {log.next && log.next !== 'END' && log.next !== 'unknown' && (
                  <div className="text-xs text-amber-400 mt-2">→ Next: {log.next}</div>
                )}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>

          {/* Generated Files */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 h-155 flex flex-col">
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-zinc-800">
              <span className="font-semibold">Generated Files</span>
              <span className="text-zinc-500 text-xs ml-auto">{files.length} file{files.length !== 1 ? 's' : ''}</span>
            </div>

            {files.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 text-zinc-600 text-center">
                <p>No files generated yet.</p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-2 mb-4">
                  {files.map((f) => (
                    <button
                      key={f.filename}
                      onClick={() => setSelectedFile(f)}
                      className={`px-3 py-1 rounded-lg text-xs transition ${
                        selectedFile?.filename === f.filename
                          ? 'bg-emerald-600 text-white'
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      }`}
                    >
                      {f.filename}
                    </button>
                  ))}
                </div>
                {selectedFile && (
                  <pre className="flex-1 overflow-auto text-xs text-emerald-300 bg-zinc-950 rounded-2xl p-4 leading-relaxed">
                    {selectedFile.content}
                  </pre>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
