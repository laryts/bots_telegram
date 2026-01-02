-- Objectives table
CREATE TABLE IF NOT EXISTS objectives (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  target_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Key Results table
CREATE TABLE IF NOT EXISTS key_results (
  id SERIAL PRIMARY KEY,
  objective_id INTEGER NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  target_value DECIMAL(10, 2),
  current_value DECIMAL(10, 2) DEFAULT 0,
  unit VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Actions table
CREATE TABLE IF NOT EXISTS actions (
  id SERIAL PRIMARY KEY,
  key_result_id INTEGER NOT NULL REFERENCES key_results(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  progress VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Habits table
CREATE TABLE IF NOT EXISTS habits (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  frequency_type VARCHAR(20) NOT NULL DEFAULT 'daily', -- daily or weekly
  frequency_value INTEGER, -- ex: 4x por semana = 4
  unit VARCHAR(50),
  linked_action_id INTEGER REFERENCES actions(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Habit Logs table
CREATE TABLE IF NOT EXISTS habit_logs (
  id SERIAL PRIMARY KEY,
  habit_id INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  value DECIMAL(10, 2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_objectives_user_id ON objectives(user_id);
CREATE INDEX IF NOT EXISTS idx_key_results_objective_id ON key_results(objective_id);
CREATE INDEX IF NOT EXISTS idx_actions_key_result_id ON actions(key_result_id);
CREATE INDEX IF NOT EXISTS idx_habits_user_id ON habits(user_id);
CREATE INDEX IF NOT EXISTS idx_habits_name ON habits(name);
CREATE INDEX IF NOT EXISTS idx_habit_logs_habit_id ON habit_logs(habit_id);
CREATE INDEX IF NOT EXISTS idx_habit_logs_date ON habit_logs(date);
CREATE INDEX IF NOT EXISTS idx_habit_logs_habit_date ON habit_logs(habit_id, date);

