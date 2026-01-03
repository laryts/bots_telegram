import { pool } from '../config/database';
import { Language, normalizeLanguage } from '../utils/i18n';

export interface User {
  id: number;
  telegram_id: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  referral_code: string;
  referred_by?: string;
  timezone?: string;
  language?: string;
  created_at: Date;
}

export async function createUser(
  telegramId: string,
  username?: string,
  firstName?: string,
  lastName?: string,
  referredBy?: string,
  timezone: string = 'America/Sao_Paulo',
  languageCode?: string
): Promise<User> {
  const referralCode = generateReferralCode();
  const language = normalizeLanguage(languageCode);
  
  const result = await pool.query(
    `INSERT INTO users (telegram_id, username, first_name, last_name, referral_code, referred_by, timezone, language)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [telegramId, username, firstName, lastName, referralCode, referredBy, timezone, language]
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

export async function getUserLanguage(telegramId: string): Promise<Language> {
  const user = await getUserByTelegramId(telegramId);
  if (user && user.language) {
    return user.language as Language;
  }
  return 'pt'; // Default to Portuguese
}

export async function updateUserLanguage(telegramId: string, language: Language): Promise<void> {
  await pool.query(
    'UPDATE users SET language = $1 WHERE telegram_id = $2',
    [language, telegramId]
  );
}

function generateReferralCode(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

