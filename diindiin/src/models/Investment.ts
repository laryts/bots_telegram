import { pool } from '../config/database';

export interface Investment {
  id: number;
  user_id: number;
  name: string;
  type: string;
  amount: number;
  current_value?: number;
  purchase_date: Date;
  notes?: string;
  created_at: Date;
}

export async function createInvestment(
  userId: number,
  name: string,
  type: string,
  amount: number,
  purchaseDate: Date,
  notes?: string
): Promise<Investment> {
  const result = await pool.query(
    `INSERT INTO investments (user_id, name, type, amount, purchase_date, notes)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [userId, name, type, amount, purchaseDate, notes]
  );
  
  return result.rows[0];
}

export async function updateInvestmentValue(
  investmentId: number,
  currentValue: number
): Promise<Investment> {
  const result = await pool.query(
    `UPDATE investments 
     SET current_value = $1
     WHERE id = $2
     RETURNING *`,
    [currentValue, investmentId]
  );
  
  return result.rows[0];
}

export async function getInvestmentsByUser(userId: number): Promise<Investment[]> {
  const result = await pool.query(
    'SELECT * FROM investments WHERE user_id = $1 ORDER BY purchase_date DESC',
    [userId]
  );
  
  return result.rows;
}

export async function getInvestmentById(investmentId: number, userId: number): Promise<Investment | null> {
  const result = await pool.query(
    'SELECT * FROM investments WHERE id = $1 AND user_id = $2',
    [investmentId, userId]
  );
  
  return result.rows[0] || null;
}

export async function deleteInvestment(investmentId: number, userId: number): Promise<boolean> {
  const result = await pool.query(
    'DELETE FROM investments WHERE id = $1 AND user_id = $2',
    [investmentId, userId]
  );
  
  return (result.rowCount ?? 0) > 0;
}

export async function getTotalInvestments(userId: number): Promise<{ total_invested: number; total_value: number }> {
  const result = await pool.query(
    `SELECT 
       COALESCE(SUM(amount), 0) as total_invested,
       COALESCE(SUM(COALESCE(current_value, amount)), 0) as total_value
     FROM investments
     WHERE user_id = $1`,
    [userId]
  );
  
  return result.rows[0];
}

export async function getInvestmentsByTypeAndMonth(
  userId: number,
  year: number
): Promise<{ type: string; month: number; total: number }[]> {
  const result = await pool.query(
    `SELECT 
       type,
       EXTRACT(MONTH FROM purchase_date)::INTEGER as month,
       SUM(amount) as total
     FROM investments
     WHERE user_id = $1
     AND EXTRACT(YEAR FROM purchase_date) = $2
     GROUP BY type, EXTRACT(MONTH FROM purchase_date)
     ORDER BY type, month`,
    [userId, year]
  );
  
  return result.rows;
}
