import 'dotenv/config';
import { PasswordHasher } from '@nestjs/authentication';
import pg from 'pg';

const email = process.env.MOCK_USER_EMAIL?.trim().normalize('NFC').toLowerCase();
const password = process.env.MOCK_USER_PASSWORD;
let pool;
try {
  if (!email || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error();
  if (!password || password.length < 12 || password.length > 128) throw new Error();
  if (!process.env.DATABASE_URL) throw new Error();
  const hash = await new PasswordHasher().hash(password);
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const result = await pool.query('INSERT INTO users (email, password_hash) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id', [email, hash]);
  console.log(result.rowCount === 1 ? 'One user created.' : 'User already exists; password unchanged.');
} catch {
  console.error('Seeding failed. Check migrations, DATABASE_URL, MOCK_USER_EMAIL and MOCK_USER_PASSWORD (12–128 characters).');
  process.exitCode = 1;
} finally {
  await pool?.end();
}
