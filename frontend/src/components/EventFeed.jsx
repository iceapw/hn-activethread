export default function EventFeed({ data, loading }) {
  return (
    <div className="bg-surface-1 border border-border rounded-lg p-5 w-full flex flex-col overflow-hidden h-full">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-1.5 h-1.5 rounded-full bg-positive" />
        <p className="text-xs text-text-muted uppercase tracking-wide font-mono">Latest Comments</p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {loading && !data && (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-3 py-2 rounded border border-border/50">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-16 h-3 bg-surface-2 rounded animate-pulse" />
                <div className="h-3 bg-surface-2 rounded animate-pulse flex-1" />
              </div>
              <div className="h-3 bg-surface-2 rounded animate-pulse w-3/4 mb-1" />
              <div className="h-3 bg-surface-2 rounded animate-pulse w-1/2" />
            </div>
          ))
        )}

        {!loading && (!data || data.length === 0) && (
          <div className="flex-1 flex items-center justify-center py-10">
            <p className="text-xs text-text-muted font-mono">No comments yet — waiting for data</p>
          </div>
        )}

        {data?.map((c) => {
          const commentUrl = c.comment_id
            ? `https://news.ycombinator.com/item?id=${c.comment_id}`
            : c.story_id ? `https://news.ycombinator.com/item?id=${c.story_id}` : null;

          return (
            <a
              key={c.event_id}
              href={commentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-3 py-2 rounded border border-border/50 hover:bg-surface-2/50 hover:border-border transition-colors cursor-pointer no-underline"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-mono text-text-muted truncate flex-1">
                  {c.title || c.content_id}
                </span>
                <span className="font-mono text-text-muted shrink-0 text-[10px]">
                  {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-xs text-text-secondary font-mono leading-relaxed">
                {c.text}
              </p>
              <p className="text-[10px] text-text-muted font-mono mt-1">{c.author}</p>
            </a>
          );
        })}
      </div>
    </div>
  );
}
