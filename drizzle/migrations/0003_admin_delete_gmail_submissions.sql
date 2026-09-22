GRANT DELETE ON public.gmail_submissions TO authenticated;

CREATE POLICY "Admins delete submissions"
ON public.gmail_submissions
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));