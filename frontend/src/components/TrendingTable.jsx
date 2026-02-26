export default function TrendingTable({ data, loading }) {
  return (
    <div className="bg-surface-1 border border-border rounded-lg p-5 w-full h-full flex flex-col overflow-hidden">
      <p className="text-xs text-text-muted uppercase tracking-wide font-mono mb-1">Most Active Stories</p>
      <p className="text-[10px] text-text-muted font-mono mb-4">Ranked by comment activity in the past hour</p>

      <div className="space-y-1 flex-1 overflow-y-auto">
        {loading && !data && (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 px-2 py-1.5">
              <div className="w-5 h-3 bg-surface-2 rounded animate-pulse" />
              <div className="h-3 bg-surface-2 rounded animate-pulse flex-1" />
            </div>
          ))
        )}

        {!loading && (!data || data.length === 0) && (
          <div className="flex-1 flex items-center justify-center py-10">
            <p className="text-xs text-text-muted font-mono">No active stories yet — waiting for data</p>
          </div>
        )}

        {data?.map((item, i) => {
          const storyId = item.content_id?.replace('hn-', '');
          const threadUrl = storyId ? `https://news.ycombinator.com/item?id=${storyId}` : null;

          return (
            <a
              key={item.content_id}
              href={threadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-surface-2/50 transition-colors no-underline"
            >
              <span className="font-mono text-text-muted text-xs w-5 shrink-0">{i + 1}</span>
              <span className="font-mono text-xs text-text-secondary flex-1">
                {item.title || item.content_id}
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
