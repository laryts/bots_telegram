import { pool } from '../config/database';
import { toUTC, fromUTC } from '../utils/timezone';

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

export interface InvestmentContribution {
  id: number;
  investment_id: number;
  amount: number;
  contribution_date: Date;
  notes?: string;
  created_at: Date;
}

export async function findInvestmentByNameAndType(
  userId: number,
  name: string,
  type: string
): Promise<Investment | null> {
  const result = await pool.query(
    'SELECT * FROM investments WHERE user_id = $1 AND LOWER(name) = LOWER($2) AND LOWER(type) = LOWER($3)',
    [userId, name, type]
  );
  
  return result.rows[0] || null;
}

export async function findInvestmentByNameOnly(
  userId: number,
  name: string
): Promise<Investment | null> {
  const result = await pool.query(
    'SELECT * FROM investments WHERE user_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1',
    [userId, name]
  );
  
  return result.rows[0] || null;
}

export async function findInvestmentsByNameExact(
  userId: number,
  name: string
): Promise<Investment[]> {
  const result = await pool.query(
    `SELECT DISTINCT ON (name, type)
       i.id,
       i.user_id,
       i.name,
       i.type,
       i.amount,
       i.current_value,
       i.purchase_date,
       i.notes,
       i.created_at
     FROM investments i
     WHERE i.user_id = $1 AND LOWER(i.name) = LOWER($2)
     ORDER BY i.name, i.type, i.purchase_date DESC`,
    [userId, name]
  );
  
  return result.rows;
}

export async function findInvestmentsByName(
  userId: number,
  name: string,
  limit: number = 10
): Promise<Investment[]> {
  const result = await pool.query(
    `SELECT DISTINCT ON (name, type)
       i.id,
       i.user_id,
       i.name,
       i.type,
       i.amount,
       i.current_value,
       i.purchase_date,
       i.notes,
       i.created_at
     FROM investments i
     WHERE i.user_id = $1 AND LOWER(i.name) LIKE LOWER($2)
     ORDER BY i.name, i.type, i.purchase_date DESC
     LIMIT $3`,
    [userId, `%${name}%`, limit]
  );
  
  return result.rows;
}

export async function findOrCreateInvestment(
  userId: number,
  name: string,
  type: string,
  notes?: string
): Promise<Investment> {
  const existing = await findInvestmentByNameAndType(userId, name, type);
  
  if (existing) {
    return existing;
  }
  
  // Create new investment without amount/purchase_date (those are in contributions now)
  const result = await pool.query(
    `INSERT INTO investments (user_id, name, type, amount, purchase_date, notes)
     VALUES ($1, $2, $3, 0, CURRENT_DATE, $4)
     RETURNING *`,
    [userId, name, type, notes]
  );
  
  return result.rows[0];
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

export async function updateInvestmentValueByNameAndType(
  userId: number,
  name: string,
  type: string,
  currentValue: number
): Promise<Investment | null> {
  const investment = await findInvestmentByNameAndType(userId, name, type);
  
  if (!investment) {
    return null;
  }
  
  return await updateInvestmentValue(investment.id, currentValue);
}

export async function getInvestmentsByUser(userId: number): Promise<Investment[]> {
  // Get unique investments by name+type, using the most recent purchase_date
  const result = await pool.query(
    `SELECT DISTINCT ON (name, type)
       i.id,
       i.user_id,
       i.name,
       i.type,
       i.amount,
       i.current_value,
       i.purchase_date,
       i.notes,
       i.created_at
     FROM investments i
     WHERE i.user_id = $1
     ORDER BY i.name, i.type, i.purchase_date DESC`,
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
       COALESCE(SUM(ic.amount), 0) as total_invested,
       COALESCE(SUM(COALESCE(i.current_value, 0)), 0) as total_value
     FROM investments i
     LEFT JOIN investment_contributions ic ON i.id = ic.investment_id
     WHERE i.user_id = $1`,
    [userId]
  );
  
  return {
    total_invested: parseFloat(result.rows[0].total_invested),
    total_value: parseFloat(result.rows[0].total_value)
  };
}

export async function getInvestmentsByTypeAndMonth(
  userId: number,
  year: number
): Promise<{ type: string; month: number; total: number }[]> {
  const result = await pool.query(
    `SELECT 
       i.type,
       EXTRACT(MONTH FROM ic.contribution_date)::INTEGER as month,
       COALESCE(SUM(ic.amount), 0) as total
     FROM investments i
     INNER JOIN investment_contributions ic ON i.id = ic.investment_id
     WHERE i.user_id = $1
     AND EXTRACT(YEAR FROM ic.contribution_date) = $2
     GROUP BY i.type, EXTRACT(MONTH FROM ic.contribution_date)
     ORDER BY i.type, month`,
    [userId, year]
  );
  
  return result.rows;
}

export async function createInvestmentContribution(
  investmentId: number,
  amount: number,
  contributionDate: Date,
  notes?: string,
  currentValue?: number
): Promise<InvestmentContribution> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Insert contribution
    const contributionResult = await client.query(
      `INSERT INTO investment_contributions (investment_id, amount, contribution_date, notes)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [investmentId, amount, contributionDate, notes]
    );
    
    // Update current_value if provided
    if (currentValue !== undefined) {
      await client.query(
        `UPDATE investments 
         SET current_value = $1
         WHERE id = $2`,
        [currentValue, investmentId]
      );
    }
    
    await client.query('COMMIT');
    return contributionResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getContributionById(contributionId: number, userId: number): Promise<InvestmentContribution | null> {
  const result = await pool.query(
    `SELECT ic.*
     FROM investment_contributions ic
     INNER JOIN investments i ON ic.investment_id = i.id
     WHERE ic.id = $1 AND i.user_id = $2`,
    [contributionId, userId]
  );
  
  return result.rows[0] || null;
}

export async function updateContribution(
  contributionId: number,
  userId: number,
  amount?: number,
  contributionDate?: Date,
  notes?: string
): Promise<InvestmentContribution | null> {
  const contribution = await getContributionById(contributionId, userId);
  if (!contribution) {
    return null;
  }

  const updates: string[] = [];
  const values: any[] = [];
  let paramCount = 1;

  if (amount !== undefined) {
    updates.push(`amount = $${paramCount++}`);
    values.push(amount);
  }
  if (contributionDate !== undefined) {
    updates.push(`contribution_date = $${paramCount++}`);
    values.push(contributionDate);
  }
  if (notes !== undefined) {
    updates.push(`notes = $${paramCount++}`);
    values.push(notes);
  }

  if (updates.length === 0) {
    return contribution;
  }

  values.push(contributionId);
  const result = await pool.query(
    `UPDATE investment_contributions 
     SET ${updates.join(', ')}
     WHERE id = $${paramCount}
     RETURNING *`,
    values
  );
  
  return result.rows[0] || null;
}

export async function deleteContribution(contributionId: number, userId: number): Promise<boolean> {
  const contribution = await getContributionById(contributionId, userId);
  if (!contribution) {
    return false;
  }

  const result = await pool.query(
    'DELETE FROM investment_contributions WHERE id = $1',
    [contributionId]
  );
  
  return (result.rowCount ?? 0) > 0;
}

export async function getContributionsByInvestment(
  userId: number,
  name: string,
  type: string
): Promise<InvestmentContribution[]> {
  const result = await pool.query(
    `SELECT ic.*
     FROM investment_contributions ic
     INNER JOIN investments i ON ic.investment_id = i.id
     WHERE i.user_id = $1 AND i.name = $2 AND i.type = $3
     ORDER BY ic.contribution_date DESC`,
    [userId, name, type]
  );
  
  return result.rows;
}

export async function getTotalContributedByInvestment(
  userId: number,
  name: string,
  type: string
): Promise<number> {
  const result = await pool.query(
    `SELECT COALESCE(SUM(ic.amount), 0) as total
     FROM investment_contributions ic
     INNER JOIN investments i ON ic.investment_id = i.id
     WHERE i.user_id = $1 AND i.name = $2 AND i.type = $3`,
    [userId, name, type]
  );
  
  return parseFloat(result.rows[0].total);
}

export async function getInvestmentsWithContributions(userId: number): Promise<Array<Investment & { total_contributed: number; contribution_count: number }>> {
  const result = await pool.query(
    `SELECT 
       i.*,
       COALESCE(SUM(ic.amount), 0) as total_contributed,
       COUNT(ic.id) as contribution_count
     FROM investments i
     LEFT JOIN investment_contributions ic ON i.id = ic.investment_id
     WHERE i.user_id = $1
     GROUP BY i.id
     ORDER BY i.name, i.type`,
    [userId]
  );
  
  return result.rows.map(row => ({
    ...row,
    total_contributed: parseFloat(row.total_contributed),
    contribution_count: parseInt(row.contribution_count)
  }));
}

export async function getMonthlyContributions(
  userId: number,
  year: number,
  month: number,
  timezone?: string
): Promise<Array<InvestmentContribution & { investment_name: string; investment_type: string }>> {
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
    
    // Get all contributions in the UTC range
    const result = await pool.query(
      `SELECT ic.*, i.name as investment_name, i.type as investment_type
       FROM investment_contributions ic
       INNER JOIN investments i ON ic.investment_id = i.id
       WHERE i.user_id = $1 
       AND ic.contribution_date >= $2 
       AND ic.contribution_date <= $3
       ORDER BY ic.contribution_date DESC`,
      [userId, startOfMonth, endOfMonth]
    );
    
    // Filter by month/year in user timezone
    const filtered = result.rows.filter(row => {
      const zonedDate = fromUTC(new Date(row.contribution_date), timezone!);
      return zonedDate.getFullYear() === year && zonedDate.getMonth() + 1 === month;
    });
    
    return filtered;
  } catch (error: any) {
    // If table doesn't exist, return empty array
    if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
      console.log('Investment contributions table does not exist yet, returning empty array');
      return [];
    }
    throw error;
  }
}

export async function getTotalContributionsByMonth(
  userId: number,
  year: number,
  month: number,
  timezone?: string
): Promise<number> {
  try {
    const contributions = await getMonthlyContributions(userId, year, month, timezone);
    return contributions.reduce((sum, contrib) => sum + parseFloat(String(contrib.amount)), 0);
  } catch (error: any) {
    if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
      return 0;
    }
    throw error;
  }
}
