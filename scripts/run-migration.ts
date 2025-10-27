import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

async function runMigration() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('Missing DATABASE_URL environment variable');
    process.exit(1);
  }

  const client = new Client({
    connectionString: databaseUrl,
  });

  try {
    await client.connect();
    console.log('Connected to database');

    const sqlPath = path.join(__dirname, '..', 'migrations', 'add_hometown_and_favourite_foods.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    console.log('Running migration...');
    console.log(sql);

    const result = await client.query(sql);

    console.log('Migration completed successfully!');
    console.log('Result:', result);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
