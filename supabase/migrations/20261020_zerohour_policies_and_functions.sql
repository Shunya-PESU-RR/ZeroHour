-- ==============================================================================
-- ZeroHour Ops - Supabase Migration: RLS Policies, Indexes, and Atomic RPCs
-- ==============================================================================
-- Hardened, idempotent, and security-verified migration script for ZeroHour operations.
--
-- This migration covers:
--   1. Idempotent constraints and performance indexes
--   2. Safe helper functions for roles, identity, and safe organizer bootstrap
--   3. Defensive trigger functions (state transitions, privilege escalation, audit integrity)
--   4. Dynamic cleanup of legacy RLS policies and strict privilege separation
--   5. Atomic RPC functions with concurrency row-locking (preserving frontend contract)
--   6. Hardened function execution privileges (revoked from PUBLIC)
--   7. Realtime publication configuration
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Ensure Table Structure, Constraints & Indexes (Safe to Rerun)
-- ------------------------------------------------------------------------------

DO $$
BEGIN
  -- 1a. Ensure unique constraint on evaluations(team_id, mentor_id)
  -- Checks if any unique constraint or unique index already covers (team_id, mentor_id)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'evaluations') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      JOIN pg_namespace n ON t.relnamespace = n.oid
      WHERE n.nspname = 'public'
        AND t.relname = 'evaluations'
        AND c.contype = 'u'
        AND (
          SELECT array_agg(a.attname ORDER BY array_position(c.conkey, a.attnum))
          FROM pg_attribute a
          WHERE a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
        ) = ARRAY['team_id', 'mentor_id']::name[]
    ) AND NOT EXISTS (
      SELECT 1
      FROM pg_index i
      JOIN pg_class t ON i.indrelid = t.oid
      JOIN pg_namespace n ON t.relnamespace = n.oid
      WHERE n.nspname = 'public'
        AND t.relname = 'evaluations'
        AND i.indisunique = true
        AND (
          SELECT array_agg(a.attname ORDER BY array_position(i.indkey, a.attnum))
          FROM pg_attribute a
          WHERE a.attrelid = t.oid AND a.attnum = ANY(i.indkey::int[])
        ) = ARRAY['team_id', 'mentor_id']::name[]
    ) THEN
      ALTER TABLE public.evaluations
        ADD CONSTRAINT evaluations_team_mentor_unique UNIQUE (team_id, mentor_id);
    END IF;

    -- Enforce valid evaluation statuses
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'evaluations_status_check'
    ) THEN
      ALTER TABLE public.evaluations
        ADD CONSTRAINT evaluations_status_check CHECK (status IN ('draft', 'submitted'));
    END IF;
  END IF;

  -- 1b. Enforce valid request statuses
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'requests') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'requests_status_check'
    ) THEN
      ALTER TABLE public.requests
        ADD CONSTRAINT requests_status_check CHECK (status IN ('open', 'claimed', 'resolved'));
    END IF;
  END IF;

  -- 1c. Enforce valid mentor roles
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'mentors') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'mentors_role_check'
    ) THEN
      ALTER TABLE public.mentors
        ADD CONSTRAINT mentors_role_check CHECK (role IN ('mentor', 'organizer'));
    END IF;
  END IF;
END $$;

-- Performance indexes on foreign keys and frequently filtered columns
CREATE INDEX IF NOT EXISTS idx_mentors_user_id ON public.mentors(user_id);
CREATE INDEX IF NOT EXISTS idx_mentors_role ON public.mentors(role);
CREATE INDEX IF NOT EXISTS idx_requests_status ON public.requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_claimed_by ON public.requests(claimed_by);
CREATE INDEX IF NOT EXISTS idx_evaluations_team_id ON public.evaluations(team_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_mentor_id ON public.evaluations(mentor_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_status ON public.evaluations(status);
CREATE INDEX IF NOT EXISTS idx_activity_log_actor_id ON public.activity_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON public.activity_log(created_at DESC);

-- ------------------------------------------------------------------------------
-- 2. Enable Row Level Security (RLS) & Set Replica Identity
-- ------------------------------------------------------------------------------

ALTER TABLE IF EXISTS public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mentors ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.activity_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'teams') THEN
    ALTER TABLE public.teams REPLICA IDENTITY FULL;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'mentors') THEN
    ALTER TABLE public.mentors REPLICA IDENTITY FULL;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'requests') THEN
    ALTER TABLE public.requests REPLICA IDENTITY FULL;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'evaluations') THEN
    ALTER TABLE public.evaluations REPLICA IDENTITY FULL;
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 3. Helper Functions for Roles & Identity (search_path hardened)
-- ------------------------------------------------------------------------------

-- Returns current authenticated user's linked mentor record ID
CREATE OR REPLACE FUNCTION public.get_current_mentor_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT id FROM public.mentors WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Returns true if the authenticated user has an active organizer profile
CREATE OR REPLACE FUNCTION public.is_organizer()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mentors
    WHERE user_id = auth.uid() AND role = 'organizer'
  );
$$;

-- Safe bootstrap procedure: Allows database administrators (SQL Editor or service role)
-- to register or promote the initial organizer profile linked to a Supabase Auth user.
-- Executable only by postgres and service_role (revoked from authenticated and anon).
CREATE OR REPLACE FUNCTION public.bootstrap_first_organizer(
  p_user_id UUID,
  p_name TEXT DEFAULT 'Lead Organizer'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_mentor_id UUID;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID is required';
  END IF;

  -- Validate that the user exists in Supabase Auth
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User with ID % does not exist in auth.users', p_user_id;
  END IF;

  -- Update existing mentor profile if one already exists for this user, else create new
  SELECT id INTO v_mentor_id FROM public.mentors WHERE user_id = p_user_id LIMIT 1;
  IF v_mentor_id IS NOT NULL THEN
    UPDATE public.mentors
    SET role = 'organizer',
        name = COALESCE(NULLIF(trim(p_name), ''), name)
    WHERE id = v_mentor_id;
  ELSE
    INSERT INTO public.mentors (user_id, name, role)
    VALUES (p_user_id, COALESCE(NULLIF(trim(p_name), ''), 'Lead Organizer'), 'organizer')
    RETURNING id INTO v_mentor_id;
  END IF;

  RETURN v_mentor_id;
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. Defensive Triggers (Enforce Integrity & Privilege Escalation Protection)
-- ------------------------------------------------------------------------------

-- 4a. Mentor Protection: Prevent self-promotion, role escalation, and user_id theft.
-- Allows trusted administrative sessions (Supabase SQL Editor / migrations / service_role)
-- and verified organizers to manage roles and link unlinked profiles.
CREATE OR REPLACE FUNCTION public.check_mentor_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_org_or_admin BOOLEAN;
BEGIN
  v_is_org_or_admin := (
    public.is_organizer()
    OR session_user IN ('postgres', 'supabase_admin')
    OR COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role'
  );

  -- Prevent privilege escalation: ordinary mentors cannot promote themselves or modify roles
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT v_is_org_or_admin THEN
      RAISE EXCEPTION 'Unauthorized: only organizers or database administrators can change mentor roles';
    END IF;
  END IF;

  -- Prevent identity tampering: user_id cannot be changed once established
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    -- Prevent ordinary mentors from modifying user_id or claiming other profiles
    IF OLD.user_id IS NOT NULL AND NOT (session_user IN ('postgres', 'supabase_admin')) THEN
      RAISE EXCEPTION 'Unauthorized: changing user_id on an existing mentor profile is prohibited';
    ELSIF OLD.user_id IS NULL AND NOT v_is_org_or_admin THEN
      RAISE EXCEPTION 'Unauthorized: only organizers or database administrators can link mentor profiles';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_mentor_update ON public.mentors;
CREATE TRIGGER trg_protect_mentor_update
  BEFORE UPDATE ON public.mentors
  FOR EACH ROW
  EXECUTE FUNCTION public.check_mentor_update();

-- Mentor Insert Protection:
-- Trusted administrators (SQL Editor / migrations / service_role) or existing organizers
-- can insert organizer profiles. Ordinary authenticated users cannot promote themselves.
CREATE OR REPLACE FUNCTION public.check_mentor_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_org_or_admin BOOLEAN;
BEGIN
  v_is_org_or_admin := (
    public.is_organizer()
    OR session_user IN ('postgres', 'supabase_admin')
    OR COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role'
  );

  -- Prevent non-organizers from creating organizer profiles
  IF NEW.role = 'organizer' AND NOT v_is_org_or_admin THEN
    RAISE EXCEPTION 'Unauthorized: only organizers or database administrators can create organizer accounts';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_mentor_insert ON public.mentors;
CREATE TRIGGER trg_protect_mentor_insert
  BEFORE INSERT ON public.mentors
  FOR EACH ROW
  EXECUTE FUNCTION public.check_mentor_insert();

-- 4b. Request Protection: Strict state transition machine and data consistency
CREATE OR REPLACE FUNCTION public.check_request_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status IS NULL THEN
    NEW.status := 'open';
  END IF;

  IF NEW.status NOT IN ('open', 'claimed', 'resolved') THEN
    RAISE EXCEPTION 'Invalid request status: "%". Allowed values are "open", "claimed", "resolved"', NEW.status;
  END IF;

  -- Default creation consistency
  IF NEW.status = 'open' THEN
    NEW.claimed_by := NULL;
    NEW.claimed_at := NULL;
    NEW.resolved_at := NULL;
  ELSIF NEW.status = 'claimed' THEN
    IF NEW.claimed_by IS NULL THEN
      RAISE EXCEPTION 'Claimed request must have a valid claimed_by mentor';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.mentors WHERE id = NEW.claimed_by) THEN
      RAISE EXCEPTION 'Claimed mentor does not exist';
    END IF;
    NEW.claimed_at := COALESCE(NEW.claimed_at, now());
    NEW.resolved_at := NULL;
  ELSIF NEW.status = 'resolved' THEN
    IF NEW.claimed_by IS NULL THEN
      RAISE EXCEPTION 'Resolved request must have a valid claimed_by mentor';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.mentors WHERE id = NEW.claimed_by) THEN
      RAISE EXCEPTION 'Claimed mentor does not exist';
    END IF;
    NEW.claimed_at := COALESCE(NEW.claimed_at, now());
    NEW.resolved_at := COALESCE(NEW.resolved_at, now());
    IF NEW.resolved_at < NEW.claimed_at THEN
      RAISE EXCEPTION 'Invalid timestamps: resolved_at cannot be earlier than claimed_at';
    END IF;
  END IF;

  IF NEW.created_at IS NULL THEN
    NEW.created_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_request_insert ON public.requests;
CREATE TRIGGER trg_protect_request_insert
  BEFORE INSERT ON public.requests
  FOR EACH ROW
  EXECUTE FUNCTION public.check_request_insert();

CREATE OR REPLACE FUNCTION public.check_request_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- 1. Validate status enum values
  IF NEW.status NOT IN ('open', 'claimed', 'resolved') THEN
    RAISE EXCEPTION 'Invalid request status: "%". Allowed values are "open", "claimed", "resolved"', NEW.status;
  END IF;

  -- 2. Enforce allowed state transitions:
  -- Allowed transitions:
  --   open -> open         (metadata edits)
  --   open -> claimed      (claiming request)
  --   claimed -> claimed   (reassigning mentor or metadata edits)
  --   claimed -> open      (releasing request back to queue)
  --   claimed -> resolved  (resolving request)
  --   resolved -> resolved (metadata edits only)
  -- Disallowed transitions:
  --   resolved -> open     (resolved requests cannot silently become active again)
  --   resolved -> claimed  (resolved requests cannot silently become active again)
  --   open -> resolved     (request must be claimed before it can be resolved)

  IF OLD.status = 'resolved' AND NEW.status <> 'resolved' THEN
    RAISE EXCEPTION 'Invalid request state transition: resolved requests cannot be reopened or transitioned to "%"', NEW.status;
  END IF;

  IF OLD.status = 'open' AND NEW.status = 'resolved' THEN
    RAISE EXCEPTION 'Invalid request state transition: a request must be claimed before it can be resolved';
  END IF;

  -- 3. Enforce field consistency based on target status
  IF NEW.status = 'open' THEN
    -- In open state, request must not retain claimed or resolved attributes
    NEW.claimed_by := NULL;
    NEW.claimed_at := NULL;
    NEW.resolved_at := NULL;

  ELSIF NEW.status = 'claimed' THEN
    -- In claimed state, claimed_by is mandatory and must reference an existing mentor
    IF NEW.claimed_by IS NULL THEN
      RAISE EXCEPTION 'Claimed request must have a valid claimed_by mentor';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.mentors WHERE id = NEW.claimed_by) THEN
      RAISE EXCEPTION 'Claimed mentor with id % does not exist', NEW.claimed_by;
    END IF;

    -- Ensure claimed_at is set, and resolved_at is null
    NEW.claimed_at := COALESCE(NEW.claimed_at, OLD.claimed_at, now());
    NEW.resolved_at := NULL;

  ELSIF NEW.status = 'resolved' THEN
    -- In resolved state, claimed_by, claimed_at, and resolved_at MUST all be present and consistent
    NEW.claimed_by := COALESCE(NEW.claimed_by, OLD.claimed_by);
    IF NEW.claimed_by IS NULL THEN
      RAISE EXCEPTION 'Resolved request must have a valid claimed_by mentor';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.mentors WHERE id = NEW.claimed_by) THEN
      RAISE EXCEPTION 'Claimed mentor with id % does not exist', NEW.claimed_by;
    END IF;

    NEW.claimed_at := COALESCE(NEW.claimed_at, OLD.claimed_at, now());
    NEW.resolved_at := COALESCE(NEW.resolved_at, OLD.resolved_at, now());

    IF NEW.resolved_at < NEW.claimed_at THEN
      RAISE EXCEPTION 'Invalid timestamps: resolved_at (%) cannot be earlier than claimed_at (%)', NEW.resolved_at, NEW.claimed_at;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_request_update ON public.requests;
CREATE TRIGGER trg_protect_request_update
  BEFORE UPDATE ON public.requests
  FOR EACH ROW
  EXECUTE FUNCTION public.check_request_update();

-- 4c. Evaluation Protection: Enforce workflow, lock mentor_id/team_id, timestamps
-- Organizers ARE permitted to revert a submitted evaluation to draft if an administrative correction is needed.
-- Ordinary mentors CANNOT revert submitted evaluations to draft.
-- Timestamps are strictly server-managed: submitted_at is cleared if reverted to draft,
-- set on submission, and preserved on subsequent edits.
CREATE OR REPLACE FUNCTION public.check_evaluation_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_mentor_id UUID;
  v_is_org BOOLEAN;
  v_is_trusted_admin BOOLEAN;
BEGIN
  v_caller_mentor_id := public.get_current_mentor_id();
  v_is_org := public.is_organizer();
  v_is_trusted_admin := (
    v_is_org
    OR session_user IN ('postgres', 'supabase_admin')
    OR COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role'
  );

  -- Enforce valid status values
  IF NEW.status NOT IN ('draft', 'submitted') THEN
    RAISE EXCEPTION 'Invalid evaluation status: "%". Allowed values are "draft" or "submitted"', NEW.status;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Ordinary mentors can only create evaluations under their own mentor id
    IF NOT v_is_trusted_admin THEN
      IF v_caller_mentor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authenticated user has no linked mentor profile';
      END IF;
      IF NEW.mentor_id <> v_caller_mentor_id THEN
        RAISE EXCEPTION 'Unauthorized: mentors can only create evaluations for themselves';
      END IF;
    END IF;

    -- Manage timestamps
    IF NEW.status = 'submitted' THEN
      NEW.submitted_at := COALESCE(NEW.submitted_at, now());
    ELSE
      NEW.submitted_at := NULL;
    END IF;
    NEW.updated_at := now();

  ELSIF TG_OP = 'UPDATE' THEN
    -- Prevent altering primary identity fields
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Unauthorized: evaluation id cannot be changed';
    END IF;

    IF NEW.mentor_id IS DISTINCT FROM OLD.mentor_id THEN
      RAISE EXCEPTION 'Unauthorized: mentor_id cannot be changed on an evaluation';
    END IF;

    IF NEW.team_id IS DISTINCT FROM OLD.team_id THEN
      RAISE EXCEPTION 'Unauthorized: team_id cannot be changed on an evaluation';
    END IF;

    -- Ordinary mentors can only modify their own evaluations
    IF NOT v_is_trusted_admin AND OLD.mentor_id <> v_caller_mentor_id THEN
      RAISE EXCEPTION 'Unauthorized: mentors can only modify their own evaluations';
    END IF;

    -- Workflow rule: Only organizers (or trusted admin) can revert a submitted evaluation to draft
    IF OLD.status = 'submitted' AND NEW.status = 'draft' THEN
      IF NOT v_is_trusted_admin THEN
        RAISE EXCEPTION 'Unauthorized: only organizers can revert a submitted evaluation to draft';
      END IF;
    END IF;

    -- Manage timestamps securely
    IF NEW.status = 'draft' THEN
      NEW.submitted_at := NULL;
    ELSIF NEW.status = 'submitted' THEN
      IF OLD.status = 'draft' OR OLD.submitted_at IS NULL THEN
        NEW.submitted_at := now();
      ELSE
        NEW.submitted_at := OLD.submitted_at;
      END IF;
    END IF;

    NEW.updated_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_evaluation_write ON public.evaluations;
CREATE TRIGGER trg_protect_evaluation_write
  BEFORE INSERT OR UPDATE ON public.evaluations
  FOR EACH ROW
  EXECUTE FUNCTION public.check_evaluation_write();

-- 4d. Activity Log Protection: Enforce truthful actor identity and immutable timestamps.
-- Prevents any caller (including organizers using direct client inserts) from forging actor_id.
CREATE OR REPLACE FUNCTION public.check_activity_log_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_mentor_id UUID;
  v_is_trusted_admin BOOLEAN;
BEGIN
  v_is_trusted_admin := (
    session_user IN ('postgres', 'supabase_admin')
    OR COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role'
  );

  IF auth.uid() IS NOT NULL THEN
    v_caller_mentor_id := public.get_current_mentor_id();
    IF v_caller_mentor_id IS NULL THEN
      RAISE EXCEPTION 'Unauthorized: authenticated user has no linked mentor profile';
    END IF;

    -- Prevent forging actor_id by ANY client-side caller, including organizers
    IF NEW.actor_id IS NULL THEN
      NEW.actor_id := v_caller_mentor_id;
    ELSIF NEW.actor_id <> v_caller_mentor_id THEN
      RAISE EXCEPTION 'Unauthorized: cannot forge actor_id in activity_log';
    END IF;
  ELSE
    IF NOT v_is_trusted_admin THEN
      RAISE EXCEPTION 'Unauthorized: unauthenticated client cannot insert activity logs';
    END IF;
  END IF;

  -- Timestamp is strictly server-enforced
  NEW.created_at := now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_activity_log_insert ON public.activity_log;
CREATE TRIGGER trg_check_activity_log_insert
  BEFORE INSERT ON public.activity_log
  FOR EACH ROW
  EXECUTE FUNCTION public.check_activity_log_insert();

-- ------------------------------------------------------------------------------
-- 5. Row Level Security (RLS) Policies
-- ------------------------------------------------------------------------------

-- PostgreSQL permissive policies combine with OR.
-- To prevent legacy, permissive, or duplicate policies from bypassing security,
-- dynamically drop ALL existing policies across all 5 operational tables.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('teams', 'mentors', 'requests', 'evaluations', 'activity_log')
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- Teams Policies:
CREATE POLICY "Allow authenticated read teams"
  ON public.teams FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow organizer insert teams"
  ON public.teams FOR INSERT
  TO authenticated
  WITH CHECK (public.is_organizer());

CREATE POLICY "Allow organizer update teams"
  ON public.teams FOR UPDATE
  TO authenticated
  USING (public.is_organizer())
  WITH CHECK (public.is_organizer());

CREATE POLICY "Allow organizer delete teams"
  ON public.teams FOR DELETE
  TO authenticated
  USING (public.is_organizer());

-- Mentors Policies:
CREATE POLICY "Allow authenticated read mentors"
  ON public.mentors FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow organizer insert mentors"
  ON public.mentors FOR INSERT
  TO authenticated
  WITH CHECK (public.is_organizer());

CREATE POLICY "Allow organizer update mentors"
  ON public.mentors FOR UPDATE
  TO authenticated
  USING (public.is_organizer())
  WITH CHECK (public.is_organizer());

CREATE POLICY "Allow mentor update own profile"
  ON public.mentors FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND role = 'mentor');

CREATE POLICY "Allow organizer delete mentors"
  ON public.mentors FOR DELETE
  TO authenticated
  USING (public.is_organizer());

-- Requests Policies:
CREATE POLICY "Allow authenticated read requests"
  ON public.requests FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated insert requests"
  ON public.requests FOR INSERT
  TO authenticated
  WITH CHECK (status = 'open' AND claimed_by IS NULL);

-- Direct table updates are restricted to organizers. Ordinary mentors MUST
-- use the atomic RPC functions (claim_request, release_request, resolve_request).
CREATE POLICY "Allow organizer update requests"
  ON public.requests FOR UPDATE
  TO authenticated
  USING (public.is_organizer())
  WITH CHECK (public.is_organizer());

CREATE POLICY "Allow organizer delete requests"
  ON public.requests FOR DELETE
  TO authenticated
  USING (public.is_organizer());

-- Evaluations Policies:
CREATE POLICY "Allow reading evaluations"
  ON public.evaluations FOR SELECT
  TO authenticated
  USING (
    public.is_organizer()
    OR status = 'submitted'
    OR mentor_id = public.get_current_mentor_id()
  );

CREATE POLICY "Allow mentor or organizer insert evaluations"
  ON public.evaluations FOR INSERT
  TO authenticated
  WITH CHECK (
    (public.is_organizer() OR mentor_id = public.get_current_mentor_id())
    AND status IN ('draft', 'submitted')
  );

CREATE POLICY "Allow mentor or organizer update evaluations"
  ON public.evaluations FOR UPDATE
  TO authenticated
  USING (
    public.is_organizer()
    OR mentor_id = public.get_current_mentor_id()
  )
  WITH CHECK (
    (public.is_organizer() OR mentor_id = public.get_current_mentor_id())
    AND status IN ('draft', 'submitted')
  );

CREATE POLICY "Allow organizer delete evaluations"
  ON public.evaluations FOR DELETE
  TO authenticated
  USING (public.is_organizer());

-- Activity Log Policies:
-- Only organizers can view the full activity audit trail
CREATE POLICY "Allow organizers to read activity log"
  ON public.activity_log FOR SELECT
  TO authenticated
  USING (public.is_organizer());

-- Authenticated users can insert activity log entries only for their own verified mentor identity
CREATE POLICY "Allow authenticated users to insert own activity log"
  ON public.activity_log FOR INSERT
  TO authenticated
  WITH CHECK (
    actor_id = public.get_current_mentor_id()
  );

-- Note: No UPDATE or DELETE policies on activity_log (immutable audit trail)

-- ------------------------------------------------------------------------------
-- 6. Atomic RPC Functions for Secure Request Operations
-- ------------------------------------------------------------------------------

-- Claim Request: Concurrency-safe atomic claim with row-level locking
-- Preserves frontend RPC signature: claim_request(p_request_id, p_mentor_id)
CREATE OR REPLACE FUNCTION public.claim_request(p_request_id UUID, p_mentor_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_user_id UUID;
  v_caller_mentor RECORD;
  v_target_mentor RECORD;
  v_request RECORD;
BEGIN
  -- 1. Validate caller authentication
  v_caller_user_id := auth.uid();
  IF v_caller_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Validate input parameters
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'Request ID is required';
  END IF;

  IF p_mentor_id IS NULL THEN
    RAISE EXCEPTION 'Mentor ID is required';
  END IF;

  -- 3. Fetch caller mentor profile
  SELECT * INTO v_caller_mentor FROM public.mentors WHERE user_id = v_caller_user_id;
  IF v_caller_mentor IS NULL THEN
    RAISE EXCEPTION 'Current user has no linked mentor profile';
  END IF;

  -- 4. Authorize: Ordinary mentors can only claim for themselves; organizers can assign to any mentor
  IF v_caller_mentor.role <> 'organizer' AND v_caller_mentor.id <> p_mentor_id THEN
    RAISE EXCEPTION 'Unauthorized: mentors can only claim requests for themselves';
  END IF;

  -- 5. Validate that target mentor exists
  SELECT * INTO v_target_mentor FROM public.mentors WHERE id = p_mentor_id;
  IF v_target_mentor IS NULL THEN
    RAISE EXCEPTION 'Target mentor not found';
  END IF;

  -- 6. Concurrency lock on the request row
  SELECT * INTO v_request FROM public.requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  -- 7. Ensure request is open
  IF v_request.status <> 'open' THEN
    RAISE EXCEPTION 'Request is already claimed or resolved';
  END IF;

  -- 8. Apply claim update
  UPDATE public.requests
  SET status = 'claimed',
      claimed_by = p_mentor_id,
      claimed_at = now()
  WHERE id = p_request_id;

  -- 9. Log activity using the authenticated caller as actor
  INSERT INTO public.activity_log (actor_id, action, entity_type, entity_id, details)
  VALUES (
    v_caller_mentor.id,
    'claim_request',
    'request',
    p_request_id,
    jsonb_build_object(
      'claimed_by', p_mentor_id,
      'claimed_by_name', v_target_mentor.name,
      'caller_id', v_caller_mentor.id,
      'table', v_request.table_number
    )
  );

  RETURN jsonb_build_object('success', true, 'id', p_request_id, 'claimed_by', p_mentor_id);
END;
$$;

-- Release Request: Returns request back to open queue
-- Preserves frontend RPC signature: release_request(p_request_id)
CREATE OR REPLACE FUNCTION public.release_request(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_user_id UUID;
  v_caller_mentor RECORD;
  v_request RECORD;
BEGIN
  -- 1. Validate caller authentication
  v_caller_user_id := auth.uid();
  IF v_caller_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Validate input parameters
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'Request ID is required';
  END IF;

  -- 3. Fetch caller mentor profile
  SELECT * INTO v_caller_mentor FROM public.mentors WHERE user_id = v_caller_user_id;
  IF v_caller_mentor IS NULL THEN
    RAISE EXCEPTION 'Current user has no linked mentor profile';
  END IF;

  -- 4. Concurrency lock on the request row
  SELECT * INTO v_request FROM public.requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  -- 5. Verify request is claimed
  IF v_request.status <> 'claimed' THEN
    RAISE EXCEPTION 'Request is not currently claimed';
  END IF;

  -- 6. Authorize: Only assigned mentor or organizer can release
  IF v_caller_mentor.role <> 'organizer' AND (v_request.claimed_by IS NULL OR v_request.claimed_by <> v_caller_mentor.id) THEN
    RAISE EXCEPTION 'Unauthorized: only assigned mentor or organizer can release this request';
  END IF;

  -- 7. Apply release update
  UPDATE public.requests
  SET status = 'open',
      claimed_by = NULL,
      claimed_at = NULL
  WHERE id = p_request_id;

  -- 8. Log activity
  INSERT INTO public.activity_log (actor_id, action, entity_type, entity_id, details)
  VALUES (
    v_caller_mentor.id,
    'release_request',
    'request',
    p_request_id,
    jsonb_build_object(
      'released_by', v_caller_mentor.id,
      'previous_claim', v_request.claimed_by,
      'table', v_request.table_number
    )
  );

  RETURN jsonb_build_object('success', true, 'id', p_request_id);
END;
$$;

-- Resolve Request: Marks request as resolved
-- Preserves frontend RPC signature: resolve_request(p_request_id)
CREATE OR REPLACE FUNCTION public.resolve_request(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_user_id UUID;
  v_caller_mentor RECORD;
  v_request RECORD;
  v_duration_seconds NUMERIC;
BEGIN
  -- 1. Validate caller authentication
  v_caller_user_id := auth.uid();
  IF v_caller_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Validate input parameters
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'Request ID is required';
  END IF;

  -- 3. Fetch caller mentor profile
  SELECT * INTO v_caller_mentor FROM public.mentors WHERE user_id = v_caller_user_id;
  IF v_caller_mentor IS NULL THEN
    RAISE EXCEPTION 'Current user has no linked mentor profile';
  END IF;

  -- 4. Concurrency lock on the request row
  SELECT * INTO v_request FROM public.requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  -- 5. Verify request is claimed
  IF v_request.status <> 'claimed' THEN
    RAISE EXCEPTION 'Request is not in claimed state';
  END IF;

  -- 6. Authorize: Only assigned mentor or organizer can resolve
  IF v_caller_mentor.role <> 'organizer' AND (v_request.claimed_by IS NULL OR v_request.claimed_by <> v_caller_mentor.id) THEN
    RAISE EXCEPTION 'Unauthorized: only assigned mentor or organizer can resolve this request';
  END IF;

  IF v_request.claimed_at IS NOT NULL THEN
    v_duration_seconds := ROUND(EXTRACT(EPOCH FROM (now() - v_request.claimed_at)));
  ELSE
    v_duration_seconds := NULL;
  END IF;

  -- 7. Apply resolve update
  UPDATE public.requests
  SET status = 'resolved',
      resolved_at = now()
  WHERE id = p_request_id;

  -- 8. Log activity
  INSERT INTO public.activity_log (actor_id, action, entity_type, entity_id, details)
  VALUES (
    v_caller_mentor.id,
    'resolve_request',
    'request',
    p_request_id,
    jsonb_build_object(
      'resolved_by', v_caller_mentor.id,
      'duration_seconds', v_duration_seconds,
      'table', v_request.table_number
    )
  );

  RETURN jsonb_build_object('success', true, 'id', p_request_id);
END;
$$;

-- Dedicated secure function for manual audit logging by authenticated users
-- Automatically sets actor_id from caller's linked mentor profile and applies server timestamp.
CREATE OR REPLACE FUNCTION public.log_activity(
  p_action TEXT,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_mentor_id UUID;
  v_log_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_caller_mentor_id := public.get_current_mentor_id();
  IF v_caller_mentor_id IS NULL THEN
    RAISE EXCEPTION 'Caller has no linked mentor profile';
  END IF;

  IF p_action IS NULL OR trim(p_action) = '' THEN
    RAISE EXCEPTION 'Action is required';
  END IF;

  INSERT INTO public.activity_log (actor_id, action, entity_type, entity_id, details, created_at)
  VALUES (
    v_caller_mentor_id,
    trim(p_action),
    p_entity_type,
    p_entity_id,
    COALESCE(p_details, '{}'::jsonb),
    now()
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. Hardened Function Execution Privileges
-- ------------------------------------------------------------------------------

-- Revoke default public execution privileges on all functions
REVOKE ALL ON FUNCTION public.get_current_mentor_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_current_mentor_id() TO authenticated;

REVOKE ALL ON FUNCTION public.is_organizer() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_organizer() TO authenticated;

REVOKE ALL ON FUNCTION public.claim_request(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_request(UUID, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.release_request(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_request(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.resolve_request(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_request(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.log_activity(TEXT, TEXT, UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_activity(TEXT, TEXT, UUID, JSONB) TO authenticated;

-- Bootstrap function is restricted strictly to database administrator / service_role
REVOKE ALL ON FUNCTION public.bootstrap_first_organizer(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_first_organizer(UUID, TEXT) TO postgres, service_role;

-- Internal trigger functions must NOT be directly invokable by PUBLIC or application users
REVOKE ALL ON FUNCTION public.check_mentor_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_mentor_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_request_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_request_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_evaluation_write() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_activity_log_insert() FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 8. Add Tables to Realtime Publication
-- ------------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'teams'
    ) AND EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'teams') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'mentors'
    ) AND EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'mentors') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.mentors;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'requests'
    ) AND EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'requests') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.requests;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'evaluations'
    ) AND EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'evaluations') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.evaluations;
    END IF;
  END IF;
END $$;
