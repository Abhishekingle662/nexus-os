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

const EXT_ICONS: Record<string, string> = {
  py: '🐍', js: '📜', ts: '📘', tsx: '⚛️',
  json: '📋', md: '📝', txt: '📄', sh: '⚙️', yaml: '🗂️', yml: '🗂️',
};

function fileIcon(name: string) {
  const ext = name.split('.').pop() ?? '';
  return EXT_ICONS[ext] ?? '📄';
}

const AGENT_COLORS: Record<string, string> = {
  supervisor: 'text-purple-400',
  planner:    'text-blue-400',
  researcher: 'text-yellow-400',
  coder:      'text-emerald-400',
  tester:     'text-orange-400',
  system:     'text-zinc-500',
};

function agentColor(agent?: string) {
  return AGENT_COLORS[(agent ?? '').toLowerCase()] ?? 'text-zinc-400';
}

export default function NexusDashboard() {
  const [task, setTask]               = useState('');
  const [isRunning, setIsRunning]     = useState(false);
  const [logs, setLogs]               = useState<AgentMessage[]>([]);
  const [currentTask, setCurrentTask] = useState('');
  const [wsConnected, setWsConnected] = useState(false);
  const [files, setFiles]             = useState<GeneratedFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<GeneratedFile | null>(null);
  const [panel, setPanel]             = useState<'activity' | 'file'>('activity');
  const [copied, setCopied]           = useState(false);
  const wsRef      = useRef<WebSocket | null>(null);
  const logsEndRef = useRef<HTMLDivElement | null>(null);

  const fetchFiles = async () => {
    try {
      const res  = await fetch('http://localhost:8000/files');
      const data = await res.json();
      const loaded: GeneratedFile[] = await Promise.all(
        data.files.map(async (name: string) => {
          const r = await fetch(`http://localhost:8000/files/${name}`);
          return r.json();
        })
      );
      setFiles(loaded);
      if (loaded.length > 0) {
        setSelectedFile(loaded[loaded.length - 1]);
        setPanel('file');
      }
    } catch {}
  };

  useEffect(() => {
    let destroyed = false;
    let retryTimer: ReturnType<typeof setTimeout>;

    function open() {
      if (destroyed) return;
      const ws = new WebSocket('ws://localhost:8000/ws');
      wsRef.current = ws;
      ws.onopen    = () => { if (!destroyed) setWsConnected(true); };
      ws.onmessage = (event) => {
        if (destroyed) return;
        const data: AgentMessage = JSON.parse(event.data);
        setLogs(prev => [...prev, data]);
        if (data.type === 'mission_start')    { setCurrentTask(data.task ?? ''); setIsRunning(true); }
        if (data.type === 'mission_complete') { setIsRunning(false); fetchFiles(); }
        if (data.type === 'error')             setIsRunning(false);
      };
      ws.onclose = () => {
        if (destroyed) return;
        setWsConnected(false);
        retryTimer = setTimeout(open, 3000);
      };
      ws.onerror = () => ws.close();
    }

    open();
    return () => { destroyed = true; clearTimeout(retryTimer); wsRef.current?.close(); };
  }, []);

  useEffect(() => {
    fetch('http://localhost:8000/files')
      .then(r => r.json())
      .then((data: { files: string[] }) =>
        Promise.all(data.files.map(name =>
          fetch(`http://localhost:8000/files/${name}`).then(r => r.json())
        ))
      )
      .then((loaded: GeneratedFile[]) => {
        setFiles(loaded);
        if (loaded.length > 0) { setSelectedFile(loaded[loaded.length - 1]); setPanel('file'); }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const startMission = async () => {
    if (!task.trim() || isRunning) return;
    setLogs([]);
    setPanel('activity');
    setIsRunning(true);
    try {
      await fetch('http://localhost:8000/start-mission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task }),
      });
    } catch { setIsRunning(false); }
  };

  const openFile = (f: GeneratedFile) => { setSelectedFile(f); setPanel('file'); };

  const copyContent = () => {
    if (!selectedFile) return;
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const downloadFile = (f: GeneratedFile) => {
    const url = URL.createObjectURL(new Blob([f.content], { type: 'text/plain' }));
    Object.assign(document.createElement('a'), { href: url, download: f.filename }).click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-screen bg-zinc-950 text-white flex flex-col font-mono overflow-hidden">

      {/* ── Top bar ─────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold tracking-tight">
            Nexus<span className="text-emerald-500">OS</span>
          </h1>
          <span className="text-zinc-600 text-xs hidden sm:block">GPT-4o Mini · Agent Swarm</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} />
          {wsConnected ? 'Connected' : 'Reconnecting…'}
        </div>
      </header>

      {/* ── Task input ──────────────────────────────────────────── */}
      <div className="px-6 py-3 border-b border-zinc-800 shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={task}
            onChange={e => setTask(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && startMission()}
            placeholder='e.g. "Build a Python script that fetches weather data"'
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition"
            disabled={isRunning}
          />
          <button
            onClick={startMission}
            disabled={isRunning || !task.trim() || !wsConnected}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:cursor-not-allowed px-5 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 whitespace-nowrap"
          >
            {isRunning
              ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent animate-spin rounded-full" /> Working…</>
              : 'Launch Mission'}
          </button>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left sidebar: file explorer ─────────────────────── */}
        <aside className="w-52 border-r border-zinc-800 flex flex-col shrink-0 bg-zinc-900/40">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Files</span>
            <span className="text-[11px] text-zinc-600">{files.length}</span>
          </div>

          <div className="flex-1 overflow-y-auto py-1">
            {files.length === 0 ? (
              <p className="text-[11px] text-zinc-600 px-4 py-8 text-center leading-relaxed">
                No files yet.<br />Run a mission to generate code.
              </p>
            ) : (
              files.map(f => (
                <button
                  key={f.filename}
                  onClick={() => openFile(f)}
                  className={`w-full text-left px-3 py-2 flex items-center gap-2 text-xs transition rounded-none ${
                    selectedFile?.filename === f.filename && panel === 'file'
                      ? 'bg-zinc-800 text-white'
                      : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                  }`}
                >
                  <span className="shrink-0 text-sm">{fileIcon(f.filename)}</span>
                  <span className="truncate">{f.filename}</span>
                </button>
              ))
            )}
          </div>

          {files.length > 0 && (
            <div className="px-4 py-2 border-t border-zinc-800">
              <button
                onClick={fetchFiles}
                className="w-full text-[11px] text-zinc-600 hover:text-zinc-300 transition text-center"
              >
                ↻ Refresh
              </button>
            </div>
          )}
        </aside>

        {/* ── Main panel ──────────────────────────────────────── */}
        <main className="flex-1 flex flex-col overflow-hidden">

          {/* Panel tab bar */}
          <div className="flex items-center gap-1 px-4 py-2 border-b border-zinc-800 shrink-0 bg-zinc-900/20">
            <button
              onClick={() => setPanel('activity')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition ${
                panel === 'activity' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
              Activity
              {logs.length > 0 && (
                <span className="bg-zinc-700 text-zinc-300 px-1.5 py-px rounded-full text-[10px]">{logs.length}</span>
              )}
            </button>

            {selectedFile && (
              <button
                onClick={() => setPanel('file')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition ${
                  panel === 'file' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <span>{fileIcon(selectedFile.filename)}</span>
                {selectedFile.filename}
              </button>
            )}
          </div>

          {/* ── Activity view ─────────────────────────────────── */}
          {panel === 'activity' && (
            <div className="flex-1 overflow-y-auto px-8 py-6">
              {currentTask && (
                <div className="mb-5 text-xs text-emerald-400 border-b border-zinc-800 pb-3">
                  Mission: {currentTask}
                </div>
              )}

              {!isRunning && logs.length === 0 && (
                <div className="flex flex-col items-center justify-center h-64 text-zinc-600 text-center gap-2">
                  <span className="text-3xl">🤖</span>
                  <p className="text-sm">No missions yet. Enter a task above.</p>
                </div>
              )}

              {isRunning && logs.length === 0 && (
                <div className="flex flex-col items-center justify-center h-64 text-center gap-4">
                  <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent animate-spin rounded-full" />
                  <p className="text-emerald-400 text-sm font-medium">Agents are thinking…</p>
                </div>
              )}

              {logs.map((log, i) => (
                <div key={i} className={`mb-5 border-l-2 pl-4 ${
                  log.type === 'error'            ? 'border-red-500' :
                  log.type === 'mission_complete' ? 'border-emerald-500' :
                                                    'border-zinc-700'
                }`}>
                  {log.agent && (
                    <div className={`text-[10px] uppercase tracking-widest mb-1 font-semibold ${agentColor(log.agent)}`}>
                      {log.agent} Agent
                    </div>
                  )}
                  <div className={`text-sm leading-relaxed whitespace-pre-wrap ${
                    log.type === 'error'            ? 'text-red-400' :
                    log.type === 'mission_complete' ? 'text-emerald-400' :
                                                      'text-zinc-300'
                  }`}>
                    {log.content}
                  </div>
                  {log.next && log.next !== 'END' && log.next !== 'unknown' && (
                    <div className="text-[11px] text-amber-400 mt-1.5">→ {log.next}</div>
                  )}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}

          {/* ── File viewer ───────────────────────────────────── */}
          {panel === 'file' && selectedFile && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* File toolbar */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/30 shrink-0">
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <span>{fileIcon(selectedFile.filename)}</span>
                  <span className="text-zinc-300">{selectedFile.filename}</span>
                  <span className="text-zinc-600">
                    · {selectedFile.content.split('\n').length} lines
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={copyContent}
                    className="text-[11px] text-zinc-500 hover:text-zinc-200 transition px-2.5 py-1 rounded hover:bg-zinc-800"
                  >
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                  <button
                    onClick={() => downloadFile(selectedFile)}
                    className="text-[11px] text-zinc-500 hover:text-zinc-200 transition px-2.5 py-1 rounded hover:bg-zinc-800"
                  >
                    ↓ Download
                  </button>
                </div>
              </div>

              {/* Line-numbered code view */}
              <div className="flex-1 overflow-auto">
                <table className="w-full text-xs border-collapse">
                  <tbody>
                    {selectedFile.content.split('\n').map((line, i) => (
                      <tr key={i} className="hover:bg-zinc-900/40">
                        <td className="select-none text-right text-zinc-600 pr-4 pl-4 py-px w-10 border-r border-zinc-800 align-top leading-5">
                          {i + 1}
                        </td>
                        <td className="pl-4 pr-4 py-px text-emerald-300 whitespace-pre leading-5 align-top">
                          {line || ' '}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
