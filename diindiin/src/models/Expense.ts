import { pool } from '../config/database';
import { toUTC, fromUTC, nowInTimezone } from '../utils/timezone';

export interface Expense {
  id: number;
  user_id: number;
  amount: number;
  description: string;
  category: string;
  date: Date;
  created_at: Date;
}

export async function createExpense(
  userId: number,
  amount: number,
  description: string,
  category: string,
  timezone?: string
): Promise<Expense> {
  // Get user timezone if not provided
  if (!timezone) {
    const userResult = await pool.query('SELECT timezone FROM users WHERE id = $1', [userId]);
    timezone = userResult.rows[0]?.timezone || 'America/Sao_Paulo';
  }
  
  // Get current date in user timezone, then convert to UTC
  const nowInUserTz = nowInTimezone(timezone);
  const utcDate = toUTC(nowInUserTz, timezone);
  
  const result = await pool.query(
    `INSERT INTO expenses (user_id, amount, description, category, date)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, amount, description, category, utcDate]
  );
  
  return result.rows[0];
}

export async function getExpensesByUser(
  userId: number,
  startDate?: Date,
  endDate?: Date
): Promise<Expense[]> {
  let query = 'SELECT * FROM expenses WHERE user_id = $1';
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

export async function getMonthlyExpenses(userId: number, year: number, month: number, timezone?: string): Promise<Expense[]> {
  // Get user timezone if not provided
  if (!timezone) {
    const userResult = await pool.query('SELECT timezone FROM users WHERE id = $1', [userId]);
    timezone = userResult.rows[0]?.timezone || 'America/Sao_Paulo';
  }
  
  // Convert month boundaries to UTC for comparison
  const monthStr = String(month).padStart(2, '0');
  const startOfMonth = toUTC(new Date(`${year}-${monthStr}-01T00:00:00`), timezone);
  const endOfMonth = toUTC(new Date(`${year}-${monthStr}-${new Date(year, month, 0).getDate()}T23:59:59`), timezone);
  
  // Get all expenses in the UTC range, then filter by month/year in user timezone
  const result = await pool.query(
    `SELECT * FROM expenses 
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
}

export async function getExpensesByCategory(
  userId: number,
  startDate?: Date,
  endDate?: Date
): Promise<{ category: string; total: number; count: number }[]> {
  let query = `
    SELECT category, SUM(amount) as total, COUNT(*) as count
    FROM expenses
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
}

export async function getTotalExpensesByMonth(userId: number, year: number, month: number, timezone?: string): Promise<number> {
  // Get user timezone if not provided
  if (!timezone) {
    const userResult = await pool.query('SELECT timezone FROM users WHERE id = $1', [userId]);
    timezone = userResult.rows[0]?.timezone || 'America/Sao_Paulo';
  }
  
  // Use getMonthlyExpenses and sum the amounts
  const expenses = await getMonthlyExpenses(userId, year, month, timezone);
  return expenses.reduce((sum, expense) => sum + parseFloat(String(expense.amount || 0)), 0);
}

export async function getExpensesByCategoryAndMonth(
  userId: number,
  year: number
): Promise<{ category: string; month: number; total: number }[]> {
  const result = await pool.query(
    `SELECT 
       category,
       EXTRACT(MONTH FROM date)::INTEGER as month,
       SUM(amount) as total
     FROM expenses
     WHERE user_id = $1
     AND EXTRACT(YEAR FROM date) = $2
     GROUP BY category, EXTRACT(MONTH FROM date)
     ORDER BY category, month`,
    [userId, year]
  );
  
  return result.rows;
}

export async function findExpensesByDescription(
  userId: number,
  description: string,
  limit: number = 10
): Promise<Expense[]> {
  const result = await pool.query(
    `SELECT * FROM expenses 
     WHERE user_id = $1 AND LOWER(description) LIKE LOWER($2)
     ORDER BY date DESC
     LIMIT $3`,
    [userId, `%${description}%`, limit]
  );
  
  return result.rows;
}

export async function deleteExpense(expenseId: number, userId: number): Promise<boolean> {
  const result = await pool.query(
    'DELETE FROM expenses WHERE id = $1 AND user_id = $2 RETURNING id',
    [expenseId, userId]
  );
  
  return result.rows.length > 0;
}
