-- Review in Supabase SQL Editor; transaction changes access policies, not stored records.
-- Intended schema: profiles(id uuid,...), study_days(user_id uuid,study_date date),
-- study_time(user_id uuid,study_date date,seconds numeric), feedback(message,name,user_id).
-- Configure backend SUPABASE_SERVICE_ROLE_KEY BEFORE applying: feedback is server-only.
BEGIN;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_time ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
-- Replace permissive policies: PostgreSQL ORs policies, so adding owner policies alone is insufficient.
DO $$ DECLARE rule record; BEGIN
  FOR rule IN SELECT tablename,policyname FROM pg_policies WHERE schemaname='public'
    AND tablename IN ('profiles','study_days','study_time','feedback') LOOP
    EXECUTE format('DROP POLICY %I ON public.%I',rule.policyname,rule.tablename);
  END LOOP;
END $$;
REVOKE ALL ON public.profiles,public.study_days,public.study_time,public.feedback FROM PUBLIC,anon,authenticated;
GRANT SELECT(id,name,ai,vibe,goals,location,lat,lon,tour_done,updated_at),
  INSERT(id,name,ai,vibe,goals,location,lat,lon,tour_done,updated_at),
  UPDATE(id,name,ai,vibe,goals,location,lat,lon,tour_done,updated_at)
  ON public.profiles TO authenticated;
GRANT SELECT(user_id,study_date),INSERT(user_id,study_date),UPDATE(user_id,study_date)
  ON public.study_days TO authenticated;
GRANT SELECT(user_id,study_date,seconds),INSERT(user_id,study_date,seconds),UPDATE(user_id,study_date,seconds)
  ON public.study_time TO authenticated;
CREATE POLICY profiles_read_own ON public.profiles FOR SELECT TO authenticated USING ((SELECT auth.uid())=id);
CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid())=id);
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated USING ((SELECT auth.uid())=id) WITH CHECK ((SELECT auth.uid())=id);
CREATE POLICY days_read_own ON public.study_days FOR SELECT TO authenticated USING ((SELECT auth.uid())=user_id);
CREATE POLICY days_insert_own ON public.study_days FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid())=user_id);
CREATE POLICY days_update_own ON public.study_days FOR UPDATE TO authenticated USING ((SELECT auth.uid())=user_id) WITH CHECK ((SELECT auth.uid())=user_id);
CREATE POLICY time_read_own ON public.study_time FOR SELECT TO authenticated USING ((SELECT auth.uid())=user_id);
CREATE POLICY time_insert_own ON public.study_time FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid())=user_id);
CREATE POLICY time_update_own ON public.study_time FOR UPDATE TO authenticated USING ((SELECT auth.uid())=user_id) WITH CHECK ((SELECT auth.uid())=user_id);
-- Feedback has no browser policies. Only the backend service role may insert it.
GRANT INSERT ON public.feedback TO service_role;
ALTER TABLE public.profiles ADD CONSTRAINT shh_profile_name CHECK (length(btrim(name)) BETWEEN 1 AND 80) NOT VALID;
ALTER TABLE public.profiles ADD CONSTRAINT shh_profile_ai CHECK (ai IN ('claude','gpt4','gemini','llama')) NOT VALID;
ALTER TABLE public.profiles ADD CONSTRAINT shh_profile_vibe CHECK (vibe IN ('gentle','balanced','strict','chill')) NOT VALID;
ALTER TABLE public.profiles ADD CONSTRAINT shh_goals_bounds CHECK (octet_length(coalesce(goals::text,'')) <= 1024) NOT VALID;
ALTER TABLE public.feedback ADD CONSTRAINT shh_feedback_size CHECK (length(message) BETWEEN 3 AND 4300) NOT VALID;
ALTER TABLE public.study_time ADD CONSTRAINT shh_time_bounds CHECK (seconds >= 0 AND seconds <= 86400) NOT VALID;
-- NOT VALID checks new writes without rejecting old records; investigate old rows before VALIDATE.
COMMIT;
