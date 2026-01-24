import React, { useMemo, useState } from "react";
import { Search } from "lucide-react";

function readEpisodes() {
  return JSON.parse(localStorage.getItem("wecast_episodes") || "[]");
}

export default function Episodes() {
  const [q, setQ] = useState("");
  const [episodes, setEpisodes] = useState(readEpisodes());

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return episodes;
    return episodes.filter((e) =>
      String(e.title || "").toLowerCase().includes(query)
    );
  }, [q, episodes]);

  return (
    <div className="min-h-screen bg-cream dark:bg-[#0a0a1a]">
      <div className="h-2 bg-purple-gradient" />
      <main className="w-full max-w-5xl mx-auto px-6 pt-28 pb-12">
        {/* Search bar */}
        <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/70 px-4 py-3 shadow-sm">
          <Search className="w-5 h-5 text-black/50 dark:text-white/50" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search episodes by title..."
            className="w-full bg-transparent outline-none text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40"
          />
        </div>

        {/* List */}
        <div className="mt-6 grid gap-4">
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/60 p-6 text-black/70 dark:text-white/70">
              No saved episodes yet.
            </div>
          ) : (
            filtered.map((ep) => (
              <button
                key={ep.id}
                onClick={() => {
                  window.location.hash = `#/preview?id=${encodeURIComponent(ep.id)}`;
                }}
                className="text-left rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/70 p-5 hover:shadow-md transition"
              >
                <div className="text-lg font-bold text-black dark:text-white">
                  {ep.title || "Untitled Episode"}
                </div>
                <div className="mt-1 text-sm text-black/60 dark:text-white/60">
                  Click to open preview
                </div>
              </button>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
