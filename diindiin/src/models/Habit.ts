import { pool } from '../config/database';
import { toUTC, fromUTC } from '../utils/timezone';
import { format } from 'date-fns-tz';

export interface Habit {
  id: number;
  user_id: number;
  name: string;
  description?: string;
  frequency_type: string; // 'daily' or 'weekly'
  frequency_value?: number;
  unit?: string;
  linked_action_id?: number;
  created_at: Date;
}

export interface HabitLog {
  id: number;
  habit_id: number;
  date: Date;
  value?: number;
  notes?: string;
  created_at: Date;
}

export async function createHabit(
  userId: number,
  name: string,
  frequencyType: string = 'daily',
  frequencyValue?: number,
  description?: string,
  unit?: string,
  linkedActionId?: number
): Promise<Habit> {
  const result = await pool.query(
    `INSERT INTO habits (user_id, name, description, frequency_type, frequency_value, unit, linked_action_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [userId, name, description, frequencyType, frequencyValue, unit, linkedActionId]
  );
  
  return result.rows[0];
}

export async function getHabitsByUser(userId: number): Promise<Habit[]> {
  const result = await pool.query(
    'SELECT * FROM habits WHERE user_id = $1 ORDER BY name ASC',
    [userId]
  );
  
  return result.rows;
}

export async function getHabitById(habitId: number, userId: number): Promise<Habit | null> {
  const result = await pool.query(
    'SELECT * FROM habits WHERE id = $1 AND user_id = $2',
    [habitId, userId]
  );
  
  return result.rows[0] || null;
}

export async function updateHabit(
  habitId: number,
  userId: number,
  name?: string,
  description?: string,
  frequencyType?: string,
  frequencyValue?: number,
  unit?: string,
  linkedActionId?: number | null
): Promise<Habit | null> {
  const updates: string[] = [];
  const values: any[] = [];
  let paramCount = 1;

  if (name !== undefined) {
    updates.push(`name = $${paramCount++}`);
    values.push(name);
  }
  if (description !== undefined) {
    updates.push(`description = $${paramCount++}`);
    values.push(description);
  }
  if (frequencyType !== undefined) {
    updates.push(`frequency_type = $${paramCount++}`);
    values.push(frequencyType);
  }
  if (frequencyValue !== undefined) {
    updates.push(`frequency_value = $${paramCount++}`);
    values.push(frequencyValue);
  }
  if (unit !== undefined) {
    updates.push(`unit = $${paramCount++}`);
    values.push(unit);
  }
  if (linkedActionId !== undefined) {
    updates.push(`linked_action_id = $${paramCount++}`);
    values.push(linkedActionId);
  }

  if (updates.length === 0) {
    return getHabitById(habitId, userId);
  }

  values.push(habitId, userId);
  const result = await pool.query(
    `UPDATE habits 
     SET ${updates.join(', ')}
     WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
     RETURNING *`,
    values
  );
  
  return result.rows[0] || null;
}

export async function linkHabitToAction(habitId: number, userId: number, actionId: number): Promise<Habit | null> {
  return updateHabit(habitId, userId, undefined, undefined, undefined, undefined, undefined, actionId);
}

export async function findHabitByName(userId: number, name: string): Promise<Habit | null> {
  // Case-insensitive partial match
  const result = await pool.query(
    `SELECT * FROM habits 
     WHERE user_id = $1 AND LOWER(name) LIKE LOWER($2)
     ORDER BY 
       CASE WHEN LOWER(name) = LOWER($2) THEN 1 ELSE 2 END,
       name ASC
     LIMIT 1`,
    [userId, `%${name}%`]
  );
  
  return result.rows[0] || null;
}

async function getUserTimezoneByHabitId(habitId: number): Promise<string> {
  const result = await pool.query(
    `SELECT u.timezone 
     FROM users u 
     INNER JOIN habits h ON h.user_id = u.id 
     WHERE h.id = $1`,
    [habitId]
  );
  return result.rows[0]?.timezone || 'America/Sao_Paulo';
}

export async function logHabit(
  habitId: number,
  date: Date,
  value?: number,
  notes?: string,
  timezone?: string
): Promise<HabitLog> {
  // Get user timezone if not provided
  if (!timezone) {
    timezone = await getUserTimezoneByHabitId(habitId);
  }
  
  // Extract date components in user timezone
  // Use format to get the date string in the user's timezone
  // This ensures we get the correct date even if the Date object was created in a different timezone
  const dateStr = format(date, 'yyyy-MM-dd', { timeZone: timezone });
  
  // Check if log already exists for this date
  const existing = await pool.query(
    `SELECT * FROM habit_logs 
     WHERE habit_id = $1 
     AND date = $2`,
    [habitId, dateStr]
  );

  if (existing.rows.length > 0) {
    // Update existing log
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (value !== undefined) {
      updates.push(`value = $${paramCount++}`);
      values.push(value);
    }
    if (notes !== undefined) {
      updates.push(`notes = $${paramCount++}`);
      values.push(notes);
    }

    if (updates.length > 0) {
      values.push(existing.rows[0].id);
      const result = await pool.query(
        `UPDATE habit_logs 
         SET ${updates.join(', ')}
         WHERE id = $${paramCount}
         RETURNING *`,
        values
      );
      return result.rows[0];
    }
    return existing.rows[0];
  }

  // Create new log with date string (DATE type, not TIMESTAMP)
  const result = await pool.query(
    `INSERT INTO habit_logs (habit_id, date, value, notes)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [habitId, dateStr, value, notes]
  );
  
  return result.rows[0];
}

export async function getHabitLogs(
  habitId: number,
  startDate?: Date,
  endDate?: Date
): Promise<HabitLog[]> {
  let query = 'SELECT * FROM habit_logs WHERE habit_id = $1';
  const params: any[] = [habitId];

  if (startDate && endDate) {
    query += ' AND date >= $2 AND date <= $3';
    params.push(startDate, endDate);
  } else if (startDate) {
    query += ' AND date >= $2';
    params.push(startDate);
  } else if (endDate) {
    query += ' AND date <= $2';
    params.push(endDate);
  }

  query += ' ORDER BY date DESC';

  const result = await pool.query(query, params);
  return result.rows;
}

export async function getHabitYearlyCount(habitId: number, year: number, timezone?: string): Promise<number> {
  // The date column is already stored as DATE in the user's timezone
  // So we can directly query by year
  const result = await pool.query(
    `SELECT COUNT(*) as count
     FROM habit_logs
     WHERE habit_id = $1
     AND EXTRACT(YEAR FROM date) = $2`,
    [habitId, year]
  );
  
  return parseInt(result.rows[0]?.count || '0', 10);
}

export async function getAllHabitsYearlyReview(userId: number, year: number, timezone?: string): Promise<Array<{ habit: Habit; count: number }>> {
  // Get user timezone if not provided
  if (!timezone) {
    const userResult = await pool.query('SELECT timezone FROM users WHERE id = $1', [userId]);
    timezone = userResult.rows[0]?.timezone || 'America/Sao_Paulo';
  }
  
  const habits = await getHabitsByUser(userId);
  const review: Array<{ habit: Habit; count: number }> = [];

  for (const habit of habits) {
    const count = await getHabitYearlyCount(habit.id, year, timezone);
    review.push({ habit, count });
  }

  return review.sort((a, b) => b.count - a.count);
}

export async function getHabitStats(habitId: number, year: number, timezone?: string): Promise<{
  totalDays: number;
  completedDays: number;
  percentage: number;
  streak: number;
}> {
  // Get user timezone if not provided
  if (!timezone) {
    timezone = await getUserTimezoneByHabitId(habitId);
  }
  
  const totalDays = year % 4 === 0 ? 366 : 365;
  const completedDays = await getHabitYearlyCount(habitId, year, timezone);
  const percentage = totalDays > 0 ? (completedDays / totalDays) * 100 : 0;

  // Calculate current streak in user timezone
  const { nowInTimezone } = await import('../utils/timezone');
  const today = nowInTimezone(timezone);
  const currentYear = today.getFullYear();
  let streak = 0;

  if (year === currentYear) {
    // Get all logs for the year (date column is already in user timezone as DATE type)
    const result = await pool.query(
      `SELECT date FROM habit_logs 
       WHERE habit_id = $1 
       AND EXTRACT(YEAR FROM date) = $2
       ORDER BY date DESC`,
      [habitId, year]
    );
    
    // Create a set of date strings (YYYY-MM-DD format)
    const logDates = new Set(
      result.rows.map(row => {
        // row.date is already a DATE, convert to string
        const dateObj = new Date(row.date);
        return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
      })
    );
    
    let checkDate = new Date(today);
    while (checkDate.getFullYear() === year) {
      const dateStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
      if (logDates.has(dateStr)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
  }

  return {
    totalDays,
    completedDays,
    percentage: Math.round(percentage * 100) / 100,
    streak
  };
}

export async function getHabitsByAction(actionId: number): Promise<Habit[]> {
  const result = await pool.query(
    'SELECT * FROM habits WHERE linked_action_id = $1',
    [actionId]
  );
  
  return result.rows;
}

