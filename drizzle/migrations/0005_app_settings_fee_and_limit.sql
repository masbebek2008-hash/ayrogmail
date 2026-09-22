ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS admin_fee integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_submission_limit integer NOT NULL DEFAULT 10;