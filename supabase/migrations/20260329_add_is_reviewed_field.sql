ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_reviewed boolean NOT NULL DEFAULT false;
