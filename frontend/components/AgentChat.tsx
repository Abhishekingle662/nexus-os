type AgentChatProps = {
  logs: string[];
};

export default function AgentChat({ logs }: AgentChatProps) {
  return (
    <section className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
      <h2 className="text-xl font-semibold mb-4">Agent Chat</h2>

      <div className="h-80 overflow-y-auto rounded-xl bg-zinc-950 p-4 border border-zinc-800 space-y-3">
        {logs.length === 0 ? (
          <p className="text-zinc-500 text-sm">No agent messages yet. Start a mission to see live updates.</p>
        ) : (
          logs.map((log, index) => (
            <div key={`${index}-${log.slice(0, 16)}`} className="bg-zinc-900 rounded-lg p-3 border border-zinc-800">
              <p className="text-sm text-zinc-200 whitespace-pre-wrap">{log}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}