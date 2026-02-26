import { useApi } from './hooks/useApi';
import TrendingTable from './components/TrendingTable';
import EventFeed from './components/EventFeed';

const REFRESH = 30000;

export default function App() {
  const { data: trending, loading: loadingTrending } = useApi('/api/trending', REFRESH);
  const { data: comments, loading: loadingComments } = useApi('/api/comments/latest', REFRESH);

  return (
    <div className="h-screen flex flex-col text-text-primary">
      <div className="border-b border-border px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="text-accent font-mono font-semibold text-sm">AT</span>
          <span className="text-text-muted text-xs">|</span>
          <span className="text-sm font-medium">ActiveThread</span>
          <span className="text-[10px] text-text-muted font-mono ml-2">Real-time HackerNews story monitoring</span>
        </div>
        <span className="text-xs text-text-muted font-mono">
          {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
      </div>

      <div className="flex-1 min-h-0 px-6 py-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
          <div className="min-h-0">
            <TrendingTable data={trending} loading={loadingTrending} />
          </div>
          <div className="min-h-0">
            <EventFeed data={comments} loading={loadingComments} />
          </div>
        </div>
      </div>
    </div>
  );
}
