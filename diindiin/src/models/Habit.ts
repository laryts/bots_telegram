import { pool } from '../config/database';

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

export async function logHabit(
  habitId: number,
  date: Date,
  value?: number,
  notes?: string
): Promise<HabitLog> {
  // Check if log already exists for this date
  const existing = await pool.query(
    'SELECT * FROM habit_logs WHERE habit_id = $1 AND date = $2',
    [habitId, date]
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

  // Create new log
  const result = await pool.query(
    `INSERT INTO habit_logs (habit_id, date, value, notes)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [habitId, date, value, notes]
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

export async function getHabitYearlyCount(habitId: number, year: number): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*) as count
     FROM habit_logs
     WHERE habit_id = $1
     AND EXTRACT(YEAR FROM date) = $2`,
    [habitId, year]
  );
  
  return parseInt(result.rows[0].count) || 0;
}

export async function getAllHabitsYearlyReview(userId: number, year: number): Promise<Array<{ habit: Habit; count: number }>> {
  const habits = await getHabitsByUser(userId);
  const review: Array<{ habit: Habit; count: number }> = [];

  for (const habit of habits) {
    const count = await getHabitYearlyCount(habit.id, year);
    review.push({ habit, count });
  }

  return review.sort((a, b) => b.count - a.count);
}

export async function getHabitStats(habitId: number, year: number): Promise<{
  totalDays: number;
  completedDays: number;
  percentage: number;
  streak: number;
}> {
  const totalDays = year % 4 === 0 ? 366 : 365;
  const completedDays = await getHabitYearlyCount(habitId, year);
  const percentage = totalDays > 0 ? (completedDays / totalDays) * 100 : 0;

  // Calculate current streak
  const today = new Date();
  const currentYear = today.getFullYear();
  let streak = 0;

  if (year === currentYear) {
    const logs = await getHabitLogs(habitId, new Date(year, 0, 1), today);
    const logDates = new Set(logs.map(log => new Date(log.date).toDateString()));
    
    let checkDate = new Date(today);
    while (checkDate.getFullYear() === year) {
      if (logDates.has(checkDate.toDateString())) {
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

