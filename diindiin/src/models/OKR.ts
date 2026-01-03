import { pool } from '../config/database';

export interface Objective {
  id: number;
  user_id: number;
  title: string;
  description?: string;
  target_date?: Date;
  created_at: Date;
}

export interface KeyResult {
  id: number;
  objective_id: number;
  title: string;
  target_value?: number;
  current_value?: number;
  unit?: string;
  created_at: Date;
}

export interface Action {
  id: number;
  key_result_id: number;
  description: string;
  status: string;
  progress?: string;
  created_at: Date;
}

export async function createObjective(
  userId: number,
  title: string,
  description?: string,
  targetDate?: Date
): Promise<Objective> {
  const result = await pool.query(
    `INSERT INTO objectives (user_id, title, description, target_date)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [userId, title, description, targetDate]
  );
  
  return result.rows[0];
}

export async function getObjectivesByUser(userId: number): Promise<Objective[]> {
  const result = await pool.query(
    'SELECT * FROM objectives WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  
  return result.rows;
}

export async function getObjectiveById(objectiveId: number, userId: number): Promise<Objective | null> {
  const result = await pool.query(
    'SELECT * FROM objectives WHERE id = $1 AND user_id = $2',
    [objectiveId, userId]
  );
  
  return result.rows[0] || null;
}

export async function updateObjective(
  objectiveId: number,
  userId: number,
  title?: string,
  description?: string,
  targetDate?: Date
): Promise<Objective | null> {
  const updates: string[] = [];
  const values: any[] = [];
  let paramCount = 1;

  if (title !== undefined) {
    updates.push(`title = $${paramCount++}`);
    values.push(title);
  }
  if (description !== undefined) {
    updates.push(`description = $${paramCount++}`);
    values.push(description);
  }
  if (targetDate !== undefined) {
    updates.push(`target_date = $${paramCount++}`);
    values.push(targetDate);
  }

  if (updates.length === 0) {
    return getObjectiveById(objectiveId, userId);
  }

  values.push(objectiveId, userId);
  const result = await pool.query(
    `UPDATE objectives 
     SET ${updates.join(', ')}
     WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
     RETURNING *`,
    values
  );
  
  return result.rows[0] || null;
}

export async function createKeyResult(
  objectiveId: number,
  title: string,
  targetValue?: number,
  unit?: string
): Promise<KeyResult> {
  const result = await pool.query(
    `INSERT INTO key_results (objective_id, title, target_value, unit)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [objectiveId, title, targetValue, unit]
  );
  
  return result.rows[0];
}

export async function getKeyResultById(keyResultId: number): Promise<KeyResult | null> {
  const result = await pool.query(
    'SELECT * FROM key_results WHERE id = $1',
    [keyResultId]
  );
  
  return result.rows[0] || null;
}

export async function findKeyResultByTitle(userId: number, title: string): Promise<KeyResult | null> {
  // Find key result by title, checking through objectives
  const result = await pool.query(
    `SELECT kr.* 
     FROM key_results kr
     INNER JOIN objectives o ON kr.objective_id = o.id
     WHERE o.user_id = $1 AND LOWER(kr.title) LIKE LOWER($2)
     ORDER BY kr.created_at DESC
     LIMIT 1`,
    [userId, `%${title}%`]
  );
  
  return result.rows[0] || null;
}

export async function getKeyResultsByObjective(objectiveId: number): Promise<KeyResult[]> {
  const result = await pool.query(
    'SELECT * FROM key_results WHERE objective_id = $1 ORDER BY created_at DESC',
    [objectiveId]
  );
  
  return result.rows;
}

export async function updateKeyResult(
  keyResultId: number,
  title?: string,
  targetValue?: number,
  currentValue?: number,
  unit?: string
): Promise<KeyResult | null> {
  const updates: string[] = [];
  const values: any[] = [];
  let paramCount = 1;

  if (title !== undefined) {
    updates.push(`title = $${paramCount++}`);
    values.push(title);
  }
  if (targetValue !== undefined) {
    updates.push(`target_value = $${paramCount++}`);
    values.push(targetValue);
  }
  if (currentValue !== undefined) {
    updates.push(`current_value = $${paramCount++}`);
    values.push(currentValue);
  }
  if (unit !== undefined) {
    updates.push(`unit = $${paramCount++}`);
    values.push(unit);
  }

  if (updates.length === 0) {
    const result = await pool.query('SELECT * FROM key_results WHERE id = $1', [keyResultId]);
    return result.rows[0] || null;
  }

  values.push(keyResultId);
  const result = await pool.query(
    `UPDATE key_results 
     SET ${updates.join(', ')}
     WHERE id = $${paramCount}
     RETURNING *`,
    values
  );
  
  return result.rows[0] || null;
}

export async function createAction(
  keyResultId: number,
  description: string,
  status: string = 'pending',
  progress?: string
): Promise<Action> {
  const result = await pool.query(
    `INSERT INTO actions (key_result_id, description, status, progress)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [keyResultId, description, status, progress]
  );
  
  return result.rows[0];
}

export async function getActionById(actionId: number): Promise<Action | null> {
  const result = await pool.query(
    'SELECT * FROM actions WHERE id = $1',
    [actionId]
  );
  
  return result.rows[0] || null;
}

export async function findActionByDescription(userId: number, description: string): Promise<Action | null> {
  // Find action by description, checking through key results and objectives
  const result = await pool.query(
    `SELECT a.* 
     FROM actions a
     INNER JOIN key_results kr ON a.key_result_id = kr.id
     INNER JOIN objectives o ON kr.objective_id = o.id
     WHERE o.user_id = $1 AND LOWER(a.description) LIKE LOWER($2)
     ORDER BY a.created_at DESC
     LIMIT 1`,
    [userId, `%${description}%`]
  );
  
  return result.rows[0] || null;
}

export async function getActionsByKeyResult(keyResultId: number): Promise<Action[]> {
  const result = await pool.query(
    'SELECT * FROM actions WHERE key_result_id = $1 ORDER BY created_at DESC',
    [keyResultId]
  );
  
  return result.rows;
}

export async function updateAction(
  actionId: number,
  description?: string,
  status?: string,
  progress?: string
): Promise<Action | null> {
  const updates: string[] = [];
  const values: any[] = [];
  let paramCount = 1;

  if (description !== undefined) {
    updates.push(`description = $${paramCount++}`);
    values.push(description);
  }
  if (status !== undefined) {
    updates.push(`status = $${paramCount++}`);
    values.push(status);
  }
  if (progress !== undefined) {
    updates.push(`progress = $${paramCount++}`);
    values.push(progress);
  }

  if (updates.length === 0) {
    const result = await pool.query('SELECT * FROM actions WHERE id = $1', [actionId]);
    return result.rows[0] || null;
  }

  values.push(actionId);
  const result = await pool.query(
    `UPDATE actions 
     SET ${updates.join(', ')}
     WHERE id = $${paramCount}
     RETURNING *`,
    values
  );
  
  return result.rows[0] || null;
}

