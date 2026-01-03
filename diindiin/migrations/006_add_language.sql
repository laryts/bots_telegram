-- Add language column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'pt';

-- Update existing users to have default language
UPDATE users SET language = 'pt' WHERE language IS NULL;

