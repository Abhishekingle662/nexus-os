const defaultTasks = [
  "Plan the mission",
  "Research best approach",
  "Generate implementation",
  "Run validation and tests",
];

export default function TaskList() {
  return (
    <section className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
      <h2 className="text-xl font-semibold mb-4">Task Pipeline</h2>

      <ul className="space-y-3">
        {defaultTasks.map((task, index) => (
          <li key={task} className="flex items-center gap-3 rounded-xl bg-zinc-950 border border-zinc-800 p-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600/20 text-emerald-400 text-xs font-semibold">
              {index + 1}
            </span>
            <span className="text-zinc-200 text-sm">{task}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}