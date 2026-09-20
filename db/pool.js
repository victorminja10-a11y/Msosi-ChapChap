const { Pool } = require('pg');

// Inatumia DATABASE_URL kutoka .env kuunganisha na Postgres yako
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost')
    ? false
    : { rejectUnauthorized: false }, // huhitajika kwa hosting nyingi za mtandaoni (Render, Railway, Supabase)
});

module.exports = pool;
