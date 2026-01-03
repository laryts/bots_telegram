-- Create investment_contributions table
CREATE TABLE IF NOT EXISTS investment_contributions (
  id SERIAL PRIMARY KEY,
  investment_id INTEGER NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  contribution_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_investment_contributions_investment_id ON investment_contributions(investment_id);
CREATE INDEX IF NOT EXISTS idx_investment_contributions_date ON investment_contributions(contribution_date);

-- Migrate existing data: create a contribution for each existing investment
INSERT INTO investment_contributions (investment_id, amount, contribution_date, notes)
SELECT id, amount, purchase_date, notes
FROM investments
WHERE NOT EXISTS (
  SELECT 1 FROM investment_contributions 
  WHERE investment_contributions.investment_id = investments.id
);

