INSERT INTO public.app_settings (id) VALUES ('global') ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.enforce_submissions_open()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE is_open boolean;
BEGIN
  SELECT submissions_open INTO is_open FROM public.app_settings WHERE id = 'global';
  IF is_open = false THEN
    RAISE EXCEPTION 'Setoran Gmail sedang ditutup';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_submissions_open ON public.gmail_submissions;
CREATE TRIGGER trg_enforce_submissions_open BEFORE INSERT ON public.gmail_submissions
FOR EACH ROW EXECUTE FUNCTION public.enforce_submissions_open();