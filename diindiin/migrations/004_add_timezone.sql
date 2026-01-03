-- Add timezone column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'America/Sao_Paulo';

-- Update existing users to have default timezone
UPDATE users SET timezone = 'America/Sao_Paulo' WHERE timezone IS NULL;

