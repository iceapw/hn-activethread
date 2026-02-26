const { readFileSync, readdirSync } = require('fs');
const { resolve, join } = require('path');
const { Client } = require('pg');

async function migrate() {
    if (!process.env.DB_PASSWORD) {
        console.error('FATAL: DB_PASSWORD environment variable is required');
        process.exit(1);
    }
    const client = new Client({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5433,
        database: process.env.DB_NAME || 'activethread_db',
        user: process.env.DB_USER || 'activethread',
        password: process.env.DB_PASSWORD,
    });

    await client.connect();
    console.log('Connected to the database');

    const migrationsDir = resolve(__dirname, 'migrations');
    const files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

    for (const file of files) {
        const sql = readFileSync(join(migrationsDir, file), 'utf-8');
        await client.query(sql);
        console.log(`Applied: ${file}`);
    }

    console.log('All migrations completed');
    await client.end();
}

migrate().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
