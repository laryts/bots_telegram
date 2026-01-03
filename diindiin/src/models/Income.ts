import { pool } from '../config/database';
import { toUTC, fromUTC, nowInTimezone } from '../utils/timezone';

export interface Income {
  id: number;
  user_id: number;
  amount: number;
  description: string;
  category: string;
  date: Date;
  created_at: Date;
}

export async function createIncome(
  userId: number,
  amount: number,
  description: string,
  category: string,
  timezone?: string
): Promise<Income> {
  // Get user timezone if not provided
  if (!timezone) {
    const userResult = await pool.query('SELECT timezone FROM users WHERE id = $1', [userId]);
    timezone = userResult.rows[0]?.timezone || 'America/Sao_Paulo';
  }
  
  // Get current date in user timezone, then convert to UTC
  const nowInUserTz = nowInTimezone(timezone);
  const utcDate = toUTC(nowInUserTz, timezone);
  
  const result = await pool.query(
    `INSERT INTO incomes (user_id, amount, description, category, date)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, amount, description, category, utcDate]
  );
  
  if (!result.rows[0]) {
    throw new Error('Failed to create income');
  }
  
  return result.rows[0];
}

export async function getIncomesByUser(
  userId: number,
  startDate?: Date,
  endDate?: Date
): Promise<Income[]> {
  let query = 'SELECT * FROM incomes WHERE user_id = $1';
  const params: any[] = [userId];
  
  if (startDate && endDate) {
    query += ' AND date >= $2 AND date <= $3';
    params.push(startDate, endDate);
  } else if (startDate) {
    query += ' AND date >= $2';
    params.push(startDate);
  }
  
  query += ' ORDER BY date DESC';
  
  const result = await pool.query(query, params);
  return result.rows;
}

export async function getMonthlyIncomes(userId: number, year: number, month: number, timezone?: string): Promise<Income[]> {
  try {
    // Get user timezone if not provided
    if (!timezone) {
      const userResult = await pool.query('SELECT timezone FROM users WHERE id = $1', [userId]);
      timezone = userResult.rows[0]?.timezone || 'America/Sao_Paulo';
    }
    
    // Convert month boundaries to UTC for comparison
    const monthStr = String(month).padStart(2, '0');
    const startOfMonth = toUTC(new Date(`${year}-${monthStr}-01T00:00:00`), timezone);
    const endOfMonth = toUTC(new Date(`${year}-${monthStr}-${new Date(year, month, 0).getDate()}T23:59:59`), timezone);
    
    // Get all incomes in the UTC range, then filter by month/year in user timezone
    const result = await pool.query(
      `SELECT * FROM incomes 
       WHERE user_id = $1 
       AND date >= $2 
       AND date <= $3
       ORDER BY date DESC`,
      [userId, startOfMonth, endOfMonth]
    );
    
    // Filter by month/year in user timezone
    const filtered = result.rows.filter(row => {
      const zonedDate = fromUTC(new Date(row.date), timezone!);
      return zonedDate.getFullYear() === year && zonedDate.getMonth() + 1 === month;
    });
    
    return filtered;
  } catch (error: any) {
    // If table doesn't exist, return empty array
    if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
      console.log('Incomes table does not exist yet, returning empty array');
      return [];
    }
    throw error;
  }
}

export async function getIncomesByCategory(
  userId: number,
  startDate?: Date,
  endDate?: Date
): Promise<{ category: string; total: number; count: number }[]> {
  try {
    let query = `
      SELECT category, SUM(amount) as total, COUNT(*) as count
      FROM incomes
      WHERE user_id = $1
    `;
    const params: any[] = [userId];
    
    if (startDate && endDate) {
      query += ' AND date >= $2 AND date <= $3';
      params.push(startDate, endDate);
    } else if (startDate) {
      query += ' AND date >= $2';
      params.push(startDate);
    }
    
    query += ' GROUP BY category ORDER BY total DESC';
    
    const result = await pool.query(query, params);
    // Ensure total is a number (PostgreSQL returns DECIMAL as string)
    return result.rows.map(row => ({
      category: row.category,
      total: parseFloat(row.total || '0'),
      count: parseInt(row.count || '0', 10)
    }));
  } catch (error: any) {
    // If table doesn't exist, return empty array
    if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
      console.log('Incomes table does not exist yet, returning empty array');
      return [];
    }
    throw error;
  }
}

export async function getTotalIncomesByMonth(userId: number, year: number, month: number, timezone?: string): Promise<number> {
  try {
    // Get user timezone if not provided
    if (!timezone) {
      const userResult = await pool.query('SELECT timezone FROM users WHERE id = $1', [userId]);
      timezone = userResult.rows[0]?.timezone || 'America/Sao_Paulo';
    }
    
    // Use getMonthlyIncomes and sum the amounts
    const incomes = await getMonthlyIncomes(userId, year, month, timezone);
    return incomes.reduce((sum, income) => sum + parseFloat(String(income.amount || 0)), 0);
  } catch (error: any) {
    // If table doesn't exist, return 0
    if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
      console.log('Incomes table does not exist yet, returning 0');
      return 0;
    }
    throw error;
  }
}

export async function getIncomesByCategoryAndMonth(
  userId: number,
  year: number
): Promise<{ category: string; month: number; total: number }[]> {
  const result = await pool.query(
    `SELECT 
       category,
       EXTRACT(MONTH FROM date)::INTEGER as month,
       SUM(amount) as total
     FROM incomes
     WHERE user_id = $1
     AND EXTRACT(YEAR FROM date) = $2
     GROUP BY category, EXTRACT(MONTH FROM date)
     ORDER BY category, month`,
    [userId, year]
  );
  
  return result.rows;
}
