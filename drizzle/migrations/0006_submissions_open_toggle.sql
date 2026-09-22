ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS submissions_open boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.enforce_submissions_open()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  is_open boolean;
BEGIN
  SELECT submissions_open INTO is_open FROM public.app_settings WHERE id = 'global';
  IF is_open IS NOT NULL AND is_open = false AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Setoran Gmail sedang ditutup';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_submissions_open ON public.gmail_submissions;
CREATE TRIGGER trg_enforce_submissions_open
BEFORE INSERT ON public.gmail_submissions
FOR EACH ROW EXECUTE FUNCTION public.enforce_submissions_open();