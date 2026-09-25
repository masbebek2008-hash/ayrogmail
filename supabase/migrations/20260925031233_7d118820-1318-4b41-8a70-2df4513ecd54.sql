DROP POLICY IF EXISTS "Admins delete submissions" ON public.gmail_submissions;
REVOKE DELETE ON public.gmail_submissions FROM authenticated;