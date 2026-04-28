'use client';

import { useEffect, useState, useRef } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────

interface AgentMessage {
  type: string;
  agent?: string;
  content: string;
  next?: string;
  task?: string;
}

interface TraceEvent {
  type: 'agent_start' | 'tool_call' | 'tool_result' | 'agent_handoff';
  agent?: string;
  tool?: string;
  args?: Record<string, string>;
  snippet?: string;
  to?: string | string[];
  ok?: boolean;
}

interface GeneratedFile {
  filename: string;
  content: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const EXT_ICONS: Record<string, string> = {
  py: '🐍', js: '📜', ts: '📘', tsx: '⚛️',
  json: '📋', md: '📝', txt: '📄', sh: '⚙️', yaml: '🗂️', yml: '🗂️',
};

const AGENT_META: Record<string, { dot: string; label: string; border: string }> = {
  supervisor: { dot: 'bg-purple-500',  label: 'text-purple-400',  border: 'border-purple-500/40' },
  researcher: { dot: 'bg-yellow-400',  label: 'text-yellow-400',  border: 'border-yellow-400/40' },
  planner:    { dot: 'bg-blue-500',    label: 'text-blue-400',    border: 'border-blue-500/40'   },
  coder:      { dot: 'bg-emerald-500', label: 'text-emerald-400', border: 'border-emerald-500/40'},
  tester:     { dot: 'bg-orange-500',  label: 'text-orange-400',  border: 'border-orange-500/40' },
};

const AGENT_COLORS: Record<string, string> = {
  supervisor: 'text-purple-400', planner: 'text-blue-400',
  researcher: 'text-yellow-400', coder: 'text-emerald-400',
  tester: 'text-orange-400',     system: 'text-zinc-500',
};

function fileIcon(name: string) {
  return EXT_ICONS[name.split('.').pop() ?? ''] ?? '📄';
}

function agentColor(agent?: string) {
  return AGENT_COLORS[(agent ?? '').toLowerCase()] ?? 'text-zinc-400';
}

function agentMeta(agent?: string) {
  return AGENT_META[(agent ?? '').toLowerCase()] ?? { dot: 'bg-zinc-500', label: 'text-zinc-400', border: 'border-zinc-700' };
}

// ── Trace view ─────────────────────────────────────────────────────────────

function AgentDot({ agent, pulse }: { agent: string; pulse?: boolean }) {
  const m = agentMeta(agent);
  return (
    <span className="relative flex h-3 w-3 shrink-0">
      {pulse && <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${m.dot} opacity-60`} />}
      <span className={`relative inline-flex rounded-full h-3 w-3 ${m.dot}`} />
    </span>
  );
}

function AgentLabel({ agent }: { agent: string }) {
  const m = agentMeta(agent);
  return (
    <span className={`text-[10px] font-bold uppercase tracking-widest ${m.label}`}>
      {agent}
    </span>
  );
}

function ParallelBadge({ agents }: { agents: string[] }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {agents.map(a => {
        const m = agentMeta(a);
        return (
          <span key={a} className={`text-[10px] font-bold uppercase tracking-wide px-2 py-px rounded-full border ${m.label} ${m.border} bg-zinc-900`}>
            {a}
          </span>
        );
      })}
      <span className="text-[10px] text-zinc-600 italic">parallel</span>
    </div>
  );
}

function BrowserCard({ query, hasResult }: { query: string; hasResult: boolean }) {
  return (
    <div className="mt-1.5 rounded-lg border border-zinc-700 bg-zinc-900 overflow-hidden text-xs w-full max-w-lg">
      {/* Browser chrome */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 border-b border-zinc-700">
        <span className="w-2 h-2 rounded-full bg-red-500/70" />
        <span className="w-2 h-2 rounded-full bg-yellow-500/70" />
        <span className="w-2 h-2 rounded-full bg-emerald-500/70" />
        <div className="ml-2 flex-1 bg-zinc-700 rounded px-2 py-0.5 text-zinc-400 flex items-center gap-1.5 truncate">
          <span className="text-cyan-400 shrink-0">🔍</span>
          <span className="truncate">{query}</span>
        </div>
        {!hasResult && (
          <div className="flex gap-px ml-1 shrink-0">
            {[0, 1, 2].map(i => (
              <span key={i} className="w-1 bg-cyan-400 rounded-full animate-pulse" style={{ height: `${8 + i * 3}px`, animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        )}
        {hasResult && <span className="text-emerald-400 ml-1 shrink-0">✓</span>}
      </div>
      {/* Status bar */}
      <div className="px-3 py-1 text-zinc-600 flex items-center gap-1.5">
        {!hasResult
          ? <><span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping inline-block" /><span>Fetching results…</span></>
          : <span className="text-emerald-500/80">Results returned</span>
        }
      </div>
    </div>
  );
}

function SnippetCard({ snippet, ok }: { snippet: string; ok: boolean }) {
  return (
    <div className={`mt-1 ml-2 rounded border ${ok ? 'border-emerald-800/50 bg-emerald-950/20' : 'border-red-800/50 bg-red-950/20'} px-3 py-2 text-[11px] font-mono text-zinc-400 leading-relaxed max-h-24 overflow-hidden relative`}>
      {snippet}
      <div className="absolute inset-x-0 bottom-0 h-6 bg-linear-to-t from-zinc-950 to-transparent" />
    </div>
  );
}

function TraceRow({ event, isLast, isRunning }: { event: TraceEvent; isLast: boolean; isRunning: boolean }) {
  const pulsing = isLast && isRunning;

  if (event.type === 'agent_start') {
    return (
      <div className="flex items-center gap-3 pt-5 pb-1">
        <AgentDot agent={event.agent!} pulse={pulsing} />
        <AgentLabel agent={event.agent!} />
        {pulsing && <span className="text-[10px] text-zinc-600 animate-pulse">thinking…</span>}
      </div>
    );
  }

  if (event.type === 'agent_handoff') {
    const to = event.to;
    const toList = Array.isArray(to) ? to : typeof to === 'string' ? [to] : [];
    const isEnd = toList.includes('END') || to === 'END';

    return (
      <div className="ml-4 pl-3 border-l border-zinc-800 py-1 flex items-center gap-2">
        <span className="text-zinc-600 text-xs">→</span>
        {isEnd
          ? <span className="text-[10px] text-zinc-500 uppercase tracking-widest">end</span>
          : toList.length > 1
            ? <ParallelBadge agents={toList} />
            : <AgentLabel agent={toList[0]} />
        }
      </div>
    );
  }

  if (event.type === 'tool_call') {
    const isBrowser = event.tool === 'web_search';
    const query = event.args?.query ?? JSON.stringify(event.args ?? {});
    return (
      <div className="ml-4 pl-3 border-l border-zinc-800 py-1">
        <div className="flex items-center gap-2">
          <span className="text-base">{isBrowser ? '🌐' : '🔧'}</span>
          <span className="text-[10px] font-mono text-cyan-400">{event.tool}</span>
        </div>
        {isBrowser
          ? <BrowserCard query={query} hasResult={false} />
          : <div className="mt-1 ml-6 text-[11px] font-mono text-zinc-500 bg-zinc-900 rounded px-2 py-1">{query}</div>
        }
      </div>
    );
  }

  if (event.type === 'tool_result') {
    const isBrowser = event.tool === 'web_search';
    return (
      <div className="ml-4 pl-3 border-l border-zinc-800 py-1">
        {isBrowser && (
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">🌐</span>
            <span className="text-[10px] font-mono text-cyan-400">{event.tool}</span>
            <span className={`text-[10px] ${event.ok ? 'text-emerald-400' : 'text-red-400'}`}>
              {event.ok ? '✓ results received' : '✗ search failed'}
            </span>
          </div>
        )}
        {!isBrowser && (
          <div className={`flex items-center gap-2 mb-1 text-[10px] ${event.ok ? 'text-emerald-400' : 'text-red-400'}`}>
            {event.ok ? '✓' : '✗'} {event.tool} returned
          </div>
        )}
        {event.snippet && <SnippetCard snippet={event.snippet} ok={event.ok ?? true} />}
      </div>
    );
  }

  return null;
}

function TraceView({ events, isRunning }: { events: TraceEvent[]; isRunning: boolean }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [events]);

  // Merge consecutive tool_call + tool_result pairs for browser cards
  const enriched = events.map((ev, i) => {
    if (ev.type === 'tool_call' && ev.tool === 'web_search') {
      const resultIdx = events.findIndex(
        (e, j) => j > i && e.type === 'tool_result' && e.tool === 'web_search'
      );
      return { ...ev, _hasResult: resultIdx !== -1 };
    }
    return ev;
  });

  if (events.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-700 text-sm">
        {isRunning
          ? <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent animate-spin rounded-full" />
              <span className="text-purple-400 text-xs">Waiting for agent activity…</span>
            </div>
          : 'No trace yet. Launch a mission to see agent activity.'}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <div className="relative max-w-2xl">
        {/* Vertical timeline line */}
        <div className="absolute left-1.25 top-8 bottom-4 w-px bg-zinc-800" />

        {enriched.map((ev, i) => {
          const isToolCall = ev.type === 'tool_call' && ev.tool === 'web_search';
          const displayEv = isToolCall
            ? { ...ev, _overrideHasResult: (ev as TraceEvent & { _hasResult?: boolean })._hasResult }
            : ev;
          return (
            <TraceRowResolved
              key={i}
              event={ev}
              hasResult={(ev as TraceEvent & { _hasResult?: boolean })._hasResult}
              isLast={i === enriched.length - 1}
              isRunning={isRunning}
            />
          );
        })}

        {isRunning && (
          <div className="flex items-center gap-3 pt-4 ml-0">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zinc-500 opacity-50" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-zinc-600" />
            </span>
            <span className="text-[10px] text-zinc-600 animate-pulse">agents working…</span>
          </div>
        )}
      </div>
      <div ref={endRef} />
    </div>
  );
}

function TraceRowResolved({
  event, hasResult, isLast, isRunning
}: {
  event: TraceEvent;
  hasResult?: boolean;
  isLast: boolean;
  isRunning: boolean;
}) {
  const pulsing = isLast && isRunning;

  if (event.type === 'agent_start') {
    return (
      <div className="flex items-center gap-3 pt-5 pb-1">
        <AgentDot agent={event.agent!} pulse={pulsing} />
        <AgentLabel agent={event.agent!} />
        {pulsing && <span className="text-[10px] text-zinc-600 animate-pulse">thinking…</span>}
      </div>
    );
  }

  if (event.type === 'agent_handoff') {
    const to = event.to;
    const toList = Array.isArray(to) ? to : typeof to === 'string' ? [to] : [];
    const isEnd = toList.includes('END') || to === 'END';
    return (
      <div className="ml-4 pl-3 border-l border-zinc-800 py-1 flex items-center gap-2">
        <span className="text-zinc-600 text-xs">→</span>
        {isEnd
          ? <span className="text-[10px] text-zinc-500 uppercase tracking-widest">end</span>
          : toList.length > 1
            ? <ParallelBadge agents={toList} />
            : <AgentLabel agent={toList[0]} />
        }
      </div>
    );
  }

  if (event.type === 'tool_call') {
    const isBrowser = event.tool === 'web_search';
    const query = event.args?.query ?? JSON.stringify(event.args ?? {});
    return (
      <div className="ml-4 pl-3 border-l border-zinc-800 py-1.5">
        <div className="flex items-center gap-2">
          <span className="text-base leading-none">{isBrowser ? '🌐' : '🔧'}</span>
          <span className="text-[10px] font-mono text-cyan-400">{event.tool}</span>
        </div>
        {isBrowser
          ? <BrowserCard query={query} hasResult={hasResult ?? false} />
          : <div className="mt-1 ml-6 text-[11px] font-mono text-zinc-500 bg-zinc-900 rounded px-2 py-1">{query}</div>
        }
      </div>
    );
  }

  if (event.type === 'tool_result') {
    return (
      <div className="ml-4 pl-3 border-l border-zinc-800 py-1">
        <div className={`flex items-center gap-1.5 text-[10px] ${event.ok ? 'text-emerald-400' : 'text-red-400'}`}>
          <span>{event.ok ? '✓' : '✗'}</span>
          <span>{event.tool} · {event.ok ? 'results received' : 'failed'}</span>
        </div>
        {event.snippet && <SnippetCard snippet={event.snippet} ok={event.ok ?? true} />}
      </div>
    );
  }

  return null;
}

// ── Main dashboard ─────────────────────────────────────────────────────────

export default function NexusDashboard() {
  const [task, setTask]                 = useState('');
  const [isRunning, setIsRunning]       = useState(false);
  const [logs, setLogs]                 = useState<AgentMessage[]>([]);
  const [traceEvents, setTraceEvents]   = useState<TraceEvent[]>([]);
  const [currentTask, setCurrentTask]   = useState('');
  const [wsConnected, setWsConnected]   = useState(false);
  const [files, setFiles]               = useState<GeneratedFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<GeneratedFile | null>(null);
  const [panel, setPanel]               = useState<'activity' | 'trace' | 'file'>('trace');
  const [copied, setCopied]             = useState(false);
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
      if (loaded.length > 0) { setSelectedFile(loaded[loaded.length - 1]); setPanel('file'); }
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
        const data = JSON.parse(event.data);

        if (data.type === 'trace_event') {
          setTraceEvents(prev => [...prev, data.event as TraceEvent]);
          return;
        }

        const msg = data as AgentMessage;
        setLogs(prev => [...prev, msg]);
        if (msg.type === 'mission_start') {
          setCurrentTask(msg.task ?? '');
          setIsRunning(true);
          setTraceEvents([]);
          setPanel('trace');
        }
        if (msg.type === 'mission_complete') { setIsRunning(false); fetchFiles(); }
        if (msg.type === 'error')             setIsRunning(false);
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
        if (loaded.length > 0) { setSelectedFile(loaded[loaded.length - 1]); }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const startMission = async () => {
    if (!task.trim() || isRunning) return;
    setLogs([]);
    setTraceEvents([]);
    setPanel('trace');
    setIsRunning(true);
    try {
      await fetch('http://localhost:8000/start-mission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task }),
      });
    } catch { setIsRunning(false); }
  };

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

      {/* ── Top bar ─────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold tracking-tight">
            Nexus<span className="text-emerald-500">OS</span>
          </h1>
          <span className="text-zinc-600 text-xs hidden sm:block">o3-mini · Agent Swarm</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} />
          {wsConnected ? 'Connected' : 'Reconnecting…'}
        </div>
      </header>

      {/* ── Task input ──────────────────────────────────────── */}
      <div className="px-6 py-3 border-b border-zinc-800 shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={task}
            onChange={e => setTask(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && startMission()}
            placeholder='e.g. "Tell me about the latest LangChain release"'
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

      {/* ── Body ────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left sidebar: file explorer ─────────────────── */}
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
                  onClick={() => { setSelectedFile(f); setPanel('file'); }}
                  className={`w-full text-left px-3 py-2 flex items-center gap-2 text-xs transition ${
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
              <button onClick={fetchFiles} className="w-full text-[11px] text-zinc-600 hover:text-zinc-300 transition text-center">
                ↻ Refresh
              </button>
            </div>
          )}
        </aside>

        {/* ── Main panel ──────────────────────────────────── */}
        <main className="flex-1 flex flex-col overflow-hidden">

          {/* Panel tab bar */}
          <div className="flex items-center gap-1 px-4 py-2 border-b border-zinc-800 shrink-0 bg-zinc-900/20">
            <button
              onClick={() => setPanel('trace')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition ${
                panel === 'trace' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-purple-400 animate-pulse' : 'bg-zinc-600'}`} />
              Trace
              {traceEvents.length > 0 && (
                <span className="bg-zinc-700 text-zinc-300 px-1.5 py-px rounded-full text-[10px]">{traceEvents.length}</span>
              )}
            </button>

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

          {/* ── Trace view ───────────────────────────────── */}
          {panel === 'trace' && (
            <div className="flex-1 overflow-hidden flex flex-col">
              {currentTask && (
                <div className="px-6 pt-3 pb-1 text-xs text-emerald-400/70 border-b border-zinc-800/50 shrink-0 truncate">
                  Mission: {currentTask}
                </div>
              )}
              <TraceView events={traceEvents} isRunning={isRunning} />
            </div>
          )}

          {/* ── Activity view ────────────────────────────── */}
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

          {/* ── File viewer ──────────────────────────────── */}
          {panel === 'file' && selectedFile && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/30 shrink-0">
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <span>{fileIcon(selectedFile.filename)}</span>
                  <span className="text-zinc-300">{selectedFile.filename}</span>
                  <span className="text-zinc-600">· {selectedFile.content.split('\n').length} lines</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={copyContent} className="text-[11px] text-zinc-500 hover:text-zinc-200 transition px-2.5 py-1 rounded hover:bg-zinc-800">
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                  <button onClick={() => downloadFile(selectedFile)} className="text-[11px] text-zinc-500 hover:text-zinc-200 transition px-2.5 py-1 rounded hover:bg-zinc-800">
                    ↓ Download
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto">
                <table className="w-full text-xs border-collapse">
                  <tbody>
                    {selectedFile.content.split('\n').map((line, i) => (
                      <tr key={i} className="hover:bg-zinc-900/40">
                        <td className="select-none text-right text-zinc-600 pr-4 pl-4 py-px w-10 border-r border-zinc-800 align-top leading-5">{i + 1}</td>
                        <td className="pl-4 pr-4 py-px text-emerald-300 whitespace-pre leading-5 align-top">{line || ' '}</td>
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
