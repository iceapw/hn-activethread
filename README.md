# HN ActiveThread

**Live:** https://hnactivethread.duckdns.org

A real-time dashboard that tracks which HackerNews stories are getting the most comments right now. Started as a Reddit monitor but Reddit's API blocks requests from cloud IPs, so I switched to HackerNews. It polls the HN API every 30 seconds, moves data through a Kafka pipeline, stores it in Postgres, and serves it to a React frontend, all running in Docker.

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

**Kafka** sits in the middle as a durable message broker. The ingester publishes each new comment as a message to a topic called `social-engagements`. The processor subscribes to that topic as a consumer group and reads messages in order, writing each one to Postgres. Kafka retains messages on disk independently of whether the processor is running, so if the processor crashes or restarts, it picks up exactly where it left off using its committed offset. No events are lost and no duplicates are created. This is the core reason Kafka is here instead of a direct database write from the ingester: the two services can fail, restart, and scale independently.

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
services/api/src/
  index.js            serves /api/trending and /api/comments/latest to the frontend

frontend/src/
  hooks/useApi.js     fetches from the API and re-fetches every 30s
  components/
    TrendingTable.jsx ranked list of stories by comment count, links to HN
    EventFeed.jsx     live scrolling feed of latest comments
  App.jsx             root layout, wires both components together
```

---

## Key Functions

**`ingester/src/index.js`**
- `poll()`: fetches top 10 stories and their last 5 comments, skips anything already seen, publishes new events to Kafka
- `makeEvent()`: builds the Kafka message schema with a UUID for deduplication
- `stripHtml()`: cleans raw HTML out of HN comment text before it hits the pipeline

**`processor/src/index.js`**
- `ensureTables()`: creates the `raw_events` table and indexes on startup if they don't exist
- `eachMessage()`: inserts each Kafka message into Postgres using `ON CONFLICT (event_id) DO NOTHING` so replayed messages don't create duplicates

**`api/src/index.js`**
- `/api/trending`: groups comments by story for the past hour, returns ranked by comment count
- `/api/comments/latest`: returns the 30 most recent comments with author and story title

**`frontend/src/hooks/useApi.js`**
- `useApi(endpoint, interval)`: fetches data on mount and re-fetches every `interval` ms, returns `{ data, loading, error }`

---

## Database

One table: `raw_events`

| Column | Type | Purpose |
|---|---|---|
| `id` | BIGSERIAL | Internal row ID |
| `event_id` | UUID UNIQUE | Idempotency key, prevents duplicate inserts |
| `platform` | VARCHAR | Always `hackernews` for now |
| `content_id` | VARCHAR | Story identifier e.g. `hn-42000000` |
| `event_type` | VARCHAR | `view` or `comment` |
| `payload` | JSONB | Full event with text, author, title, and IDs |
| `created_at` | TIMESTAMPTZ | Used for the 1-hour trending window and 24h pruning |

Indexes on `event_type`, `created_at`, `content_id`, and a composite `(event_type, created_at)` for the trending query.
