const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigrations() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Run all migrations in order
    const migrations = [
      '001_initial_schema.sql',
      '002_add_okrs.sql',
      '003_add_incomes.sql'
    ];
    
    for (const migrationFile of migrations) {
      console.log(`Running migration: ${migrationFile}`);
      const migrationSQL = fs.readFileSync(
        path.join(__dirname, migrationFile),
        'utf8'
      );
      await client.query(migrationSQL);
    }
    
    await client.query('COMMIT');
    console.log('✅ All migrations completed successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch(console.error);
