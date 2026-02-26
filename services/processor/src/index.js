const { Kafka } = require('kafkajs');
const { Pool } = require('pg');

const BROKER = process.env.KAFKA_BROKER || 'localhost:9092';
const INPUT_TOPIC = 'social-engagements';

if (!process.env.DB_PASSWORD) {
  console.error('FATAL: DB_PASSWORD environment variable is required');
  process.exit(1);
}

const kafka = new Kafka({
  clientId: 'activethread-processor',
  brokers: [BROKER],
});

const consumer = kafka.consumer({ groupId: 'activethread-processors' });

const db = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'activethread',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'activethread_db',
});

async function ensureTables() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS raw_events (
      id BIGSERIAL PRIMARY KEY,
      event_id UUID UNIQUE NOT NULL,
      platform VARCHAR(20) NOT NULL,
      content_id VARCHAR(255) NOT NULL,
      event_type VARCHAR(20) NOT NULL,
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_raw_events_created_at ON raw_events (created_at);`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_raw_events_event_type ON raw_events (event_type);`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_raw_events_content_id ON raw_events (content_id);`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_raw_events_type_created ON raw_events (event_type, created_at);`);
  console.log('Database tables ready');
}

async function start() {
  await ensureTables();

  await consumer.connect();
  await consumer.subscribe({ topic: INPUT_TOPIC, fromBeginning: false });

  console.log(`Processor listening on "${INPUT_TOPIC}"`);

  const cleanupInterval = setInterval(async () => {
    try {
      const result = await db.query(`DELETE FROM raw_events WHERE created_at < NOW() - INTERVAL '24 hours'`);
      if (result.rowCount > 0) console.log(`Cleanup: pruned ${result.rowCount} old rows`);
    } catch (err) {
      console.error('Cleanup error:', err.message);
    }
  }, 600_000);

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const event = JSON.parse(message.value.toString());

        await db.query(`
          INSERT INTO raw_events (event_id, platform, content_id, event_type, payload, created_at)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (event_id) DO NOTHING;
        `, [event.eventId, event.platform, event.contentId, event.eventType, event, event.timestamp]);
      } catch (err) {
        console.error('Message processing error:', err.message);
      }
    },
  });

  const shutdown = async () => {
    console.log('Shutting down processor...');
    clearInterval(cleanupInterval);
    await consumer.disconnect();
    await db.end();
    console.log('Processor stopped.');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((err) => {
  console.error('Processor error:', err);
  process.exit(1);
});
