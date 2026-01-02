import { pool } from '../config/database';

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
  category: string
): Promise<Expense> {
  const result = await pool.query(
    `INSERT INTO expenses (user_id, amount, description, category, date)
     VALUES ($1, $2, $3, $4, NOW())
     RETURNING *`,
    [userId, amount, description, category]
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

export async function getMonthlyExpenses(userId: number, year: number, month: number): Promise<Expense[]> {
  const result = await pool.query(
    `SELECT * FROM expenses 
     WHERE user_id = $1 
     AND EXTRACT(YEAR FROM date) = $2 
     AND EXTRACT(MONTH FROM date) = $3
     ORDER BY date DESC`,
    [userId, year, month]
  );
  
  return result.rows;
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

export async function getTotalExpensesByMonth(userId: number, year: number, month: number): Promise<number> {
  const result = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) as total
     FROM expenses
     WHERE user_id = $1
     AND EXTRACT(YEAR FROM date) = $2
     AND EXTRACT(MONTH FROM date) = $3`,
    [userId, year, month]
  );
  
  return parseFloat(result.rows[0].total);
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
