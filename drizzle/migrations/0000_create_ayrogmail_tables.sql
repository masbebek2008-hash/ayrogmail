
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE TABLE public.gmail_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gmail_address TEXT NOT NULL,
  password TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'menunggu' CHECK (status IN ('menunggu','disetujui','ditolak')),
  rate INTEGER NOT NULL DEFAULT 4000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.gmail_submissions TO authenticated;
GRANT ALL ON public.gmail_submissions TO service_role;
ALTER TABLE public.gmail_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own submissions" ON public.gmail_submissions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own submissions" ON public.gmail_submissions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL,
  account_info TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'menunggu' CHECK (status IN ('menunggu','diproses','selesai','ditolak')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.withdrawals TO authenticated;
GRANT ALL ON public.withdrawals TO service_role;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own withdrawals" ON public.withdrawals FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own withdrawals" ON public.withdrawals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
