import { pool } from '../config/database';

export interface User {
  id: number;
  telegram_id: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  referral_code: string;
  referred_by?: string;
  timezone?: string;
  created_at: Date;
}

export async function createUser(
  telegramId: string,
  username?: string,
  firstName?: string,
  lastName?: string,
  referredBy?: string,
  timezone: string = 'America/Sao_Paulo'
): Promise<User> {
  const referralCode = generateReferralCode();
  
  const result = await pool.query(
    `INSERT INTO users (telegram_id, username, first_name, last_name, referral_code, referred_by, timezone)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [telegramId, username, firstName, lastName, referralCode, referredBy, timezone]
  );
  
  return result.rows[0];
}

export async function getUserByTelegramId(telegramId: string): Promise<User | null> {
  const result = await pool.query(
    'SELECT * FROM users WHERE telegram_id = $1',
    [telegramId]
  );
  
  return result.rows[0] || null;
}

export async function getUserByReferralCode(referralCode: string): Promise<User | null> {
  const result = await pool.query(
    'SELECT * FROM users WHERE referral_code = $1',
    [referralCode]
  );
  
  return result.rows[0] || null;
}

function generateReferralCode(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

