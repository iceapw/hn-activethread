# HN ActiveThread

A real-time dashboard that tracks which HackerNews stories are getting the most comments right now. Started as a Reddit monitor but Reddit's API blocks requests from cloud IPs, so I switched to HackerNews. It polls the HN API every 30 seconds, moves data through a Kafka pipeline, stores it in Postgres, and serves it to a React frontend — all running in Docker.

---

## Architecture

```
HN Firebase API
      │  polls every 30s
      ▼
  Ingester ──────────► Kafka ──────────► Processor ──► Postgres
                    (social-engagements)                    │
                                                            ▼
                                                       Express API
                                                            │
                                                            ▼
                                                     React + Nginx
```

The ingester and processor are intentionally decoupled through Kafka — if the processor goes down, no events are lost. They queue up and get consumed when it recovers.

---

## Tech Stack

| Layer | Technology | Role |
|---|---|---|
| Data source | HN Firebase API | Public REST API for HN stories and comments |
| Ingester | Node.js + KafkaJS | Polls HN, publishes events to Kafka |
| Broker | Apache Kafka 3.7 (KRaft) | Buffers events between ingester and processor |
| Processor | Node.js + KafkaJS | Consumes events from Kafka, writes to Postgres |
| Database | PostgreSQL 16 | Stores all events, auto-prunes rows older than 24h |
| API | Express 5 + node-postgres | Queries Postgres and serves JSON |
| Frontend | React 19 + Vite + Tailwind v4 | Dashboard UI, auto-refreshes every 30s |
| Web server | Nginx | Serves the React build, proxies `/api/*` to Express |
| Prod proxy | Caddy 2 | Handles HTTPS with automatic Let's Encrypt certs |

---

## Files

```
services/
  ingester/src/
    hnClient.js       — fetches story IDs and items from HN's Firebase API
    index.js          — polls every 30s, strips HTML from comments, publishes to Kafka

  processor/src/
    index.js          — consumes Kafka events, inserts into Postgres (idempotent),
                        prunes rows older than 24h every 10 minutes

  api/src/
    index.js          — serves /api/health, /api/trending, /api/comments/latest

frontend/src/
  hooks/useApi.js     — data fetching hook with auto-refresh interval
  components/
    TrendingTable.jsx — ranked list of stories by comment count, links to HN
    EventFeed.jsx     — live scrolling feed of latest comments
  App.jsx             — root layout, wires both components together

infra/
  Caddyfile           — reverse proxy config (routes /api/* to Express, rest to Nginx)

scripts/
  deploy.sh           — installs Docker if needed, creates .env, starts all containers
  migrate.js          — standalone migration runner for the SQL files
  migrations/         — SQL for the raw_events table and indexes

docker-compose.yml       — local dev setup (frontend on :3002)
docker-compose.prod.yml  — production overlay that adds Caddy on ports 80/443
```

---

## Key Functions

**`ingester/src/index.js`**
- `poll()` — fetches top 10 stories and their last 5 comments, skips anything already seen, publishes new events to Kafka
- `makeEvent()` — builds the Kafka message schema with a UUID for deduplication
- `stripHtml()` — cleans raw HTML out of HN comment text before it hits the pipeline

**`processor/src/index.js`**
- `ensureTables()` — creates the `raw_events` table and indexes on startup if they don't exist
- `eachMessage()` — inserts each Kafka message into Postgres using `ON CONFLICT (event_id) DO NOTHING` so replayed messages don't create duplicates

**`api/src/index.js`**
- `/api/trending` — groups comments by story for the past hour, returns ranked by comment count
- `/api/comments/latest` — returns the 30 most recent comments with author and story title

**`frontend/src/hooks/useApi.js`**
- `useApi(endpoint, interval)` — fetches data on mount and re-fetches every `interval` ms, returns `{ data, loading, error }`

---

## Endpoints

```
GET /api/health
→ { "status": "ok", "timestamp": "..." }

GET /api/trending
→ top 30 stories ranked by comment activity in the past hour
  [{ "content_id", "title", "comment_count", "unique_commenters" }]

GET /api/comments/latest
→ 30 most recent comments across all stories
  [{ "event_id", "title", "text", "author", "comment_id", "story_id", "created_at" }]
```

---

## Database

One table: `raw_events`

| Column | Type | Purpose |
|---|---|---|
| `id` | BIGSERIAL | Internal row ID |
| `event_id` | UUID UNIQUE | Idempotency key — prevents duplicate inserts |
| `platform` | VARCHAR | Always `hackernews` for now |
| `content_id` | VARCHAR | Story identifier e.g. `hn-42000000` |
| `event_type` | VARCHAR | `view` or `comment` |
| `payload` | JSONB | Full event — text, author, title, IDs |
| `created_at` | TIMESTAMPTZ | Used for the 1-hour trending window and 24h pruning |

Indexes on `event_type`, `created_at`, `content_id`, and a composite `(event_type, created_at)` for the trending query.
