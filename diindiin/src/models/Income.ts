import { pool } from '../config/database';

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
  category: string
): Promise<Income> {
  const result = await pool.query(
    `INSERT INTO incomes (user_id, amount, description, category, date)
     VALUES ($1, $2, $3, $4, NOW())
     RETURNING *`,
    [userId, amount, description, category]
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

export async function getMonthlyIncomes(userId: number, year: number, month: number): Promise<Income[]> {
  try {
    const result = await pool.query(
      `SELECT * FROM incomes 
       WHERE user_id = $1 
       AND EXTRACT(YEAR FROM date) = $2 
       AND EXTRACT(MONTH FROM date) = $3
       ORDER BY date DESC`,
      [userId, year, month]
    );
    
    return result.rows;
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
  return result.rows;
}

export async function getTotalIncomesByMonth(userId: number, year: number, month: number): Promise<number> {
  try {
    const result = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM incomes
       WHERE user_id = $1
       AND EXTRACT(YEAR FROM date) = $2
       AND EXTRACT(MONTH FROM date) = $3`,
      [userId, year, month]
    );
    
    return parseFloat(result.rows[0]?.total || '0');
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
