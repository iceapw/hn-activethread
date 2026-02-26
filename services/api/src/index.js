const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const PORT = process.env.PORT || 3001;

if (!process.env.DB_PASSWORD) {
    console.error('FATAL: DB_PASSWORD environment variable is required');
    process.exit(1);
}

const app = express();
app.use(cors());
const db = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'activethread',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'activethread_db',
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/trending', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT r.content_id,
              MAX(r.payload->'metadata'->>'title') AS title,
              COUNT(*) AS comment_count,
              COUNT(DISTINCT r.payload->'metadata'->>'author') AS unique_commenters
            FROM raw_events r
            WHERE r.event_type = 'comment'
              AND r.created_at > NOW() - INTERVAL '1 hour'
            GROUP BY r.content_id
            ORDER BY comment_count DESC
            LIMIT 30;
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching trending:', err.message);
        res.status(500).json({ error: 'Failed to fetch trending threads' });
    }
});

app.get('/api/comments/latest', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT event_id, content_id, platform,
                   payload->>'text' AS text,
                   payload->'metadata'->>'author' AS author,
                   payload->'metadata'->>'commentId' AS comment_id,
                   (payload->'metadata'->>'storyId')::bigint AS story_id,
                   payload->'metadata'->>'title' AS title,
                   created_at
            FROM raw_events
            WHERE event_type = 'comment'
            ORDER BY created_at DESC
            LIMIT 30;
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching comments:', err.message);
        res.status(500).json({ error: 'Failed to fetch latest comments' });
    }
});

app.listen(PORT, () => {
    console.log(`API running on http://localhost:${PORT}`);
});

const shutdown = async () => {
    console.log('Shutting down API server...');
    await db.end();
    process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
