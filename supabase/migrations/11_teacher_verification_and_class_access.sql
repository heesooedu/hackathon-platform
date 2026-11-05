-- ==============================================================================
-- 11_teacher_verification_and_class_access.sql
-- 교사 인증 코드, 역할 부여 경로 단일화, 클래스 소유권·참여 경로 보호
--
-- 적용 순서: 이 파일을 Supabase SQL Editor에서 먼저 실행한 뒤 프론트엔드를 배포합니다.
-- 교사 인증 코드 원문은 저장소에 넣지 않습니다. 발급 방법은 파일 맨 아래 주석을 참고하세요.
-- ==============================================================================

BEGIN;

-- 1. 현재 사용자가 교사인지 확인하는 보조 함수
CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'teacher'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

REVOKE ALL ON FUNCTION public.is_teacher() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_teacher() TO authenticated;

-- 2. 가입 메타데이터는 클라이언트가 조작할 수 있으므로 교사 역할의 근거로 쓰지 않음
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, role, name, avatar_url)
  VALUES (
    new.id,
    CASE WHEN new.raw_user_meta_data->>'role' = 'student' THEN 'student' ELSE NULL END,
    COALESCE(
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'full_name',
      split_part(new.email, '@', 1)
    ),
    NULL
  )
  ON CONFLICT (id) DO UPDATE SET
    name = COALESCE(EXCLUDED.name, public.profiles.name),
    avatar_url = NULL;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. 클라이언트의 role 직접 수정 차단 (이름만 수정 가능)
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
REVOKE INSERT, UPDATE ON public.profiles FROM PUBLIC, anon, authenticated;
GRANT UPDATE (name) ON public.profiles TO authenticated;

-- 교사 역할 부여와 역할 회수는 아래 RPC가 트랜잭션 범위 플래그를 켠 경우에만 허용
CREATE OR REPLACE FUNCTION public.prevent_profile_role_change()
RETURNS trigger AS $$
DECLARE
  v_allowed BOOLEAN := COALESCE(current_setting('app.role_change_allowed', true), '') = 'on';
BEGIN
  IF NEW.role IS NOT DISTINCT FROM OLD.role OR v_allowed THEN
    RETURN NEW;
  END IF;

  IF OLD.role IS NOT NULL THEN
    RAISE EXCEPTION '한 번 설정된 역할(교사/학생)은 변경할 수 없습니다.';
  END IF;

  IF NEW.role = 'teacher' THEN
    RAISE EXCEPTION '교사 역할은 교사 인증 코드로만 받을 수 있습니다.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. 교사 인증 코드 저장소 (원문 없이 해시만 저장, 클라이언트 접근 불가)
CREATE TABLE IF NOT EXISTS public.teacher_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash TEXT NOT NULL UNIQUE,
  label TEXT,
  max_uses INT NOT NULL DEFAULT 30 CHECK (max_uses > 0),
  used_count INT NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.teacher_code_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code_id UUID REFERENCES public.teacher_codes(id) ON DELETE SET NULL,
  succeeded BOOLEAN NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teacher_code_attempts_user
  ON public.teacher_code_attempts(user_id, attempted_at DESC);

ALTER TABLE public.teacher_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_code_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.teacher_codes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.teacher_code_attempts FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.hash_teacher_code(p_code TEXT)
RETURNS TEXT AS $$
  SELECT encode(
    sha256(convert_to(upper(regexp_replace(COALESCE(p_code, ''), '[^A-Za-z0-9]', '', 'g')), 'UTF8')),
    'hex'
  );
$$ LANGUAGE sql IMMUTABLE SET search_path = public;

REVOKE ALL ON FUNCTION public.hash_teacher_code(TEXT) FROM PUBLIC, anon, authenticated;

-- 5. 교사 인증 코드 확인 후 교사 역할 부여 (교사 역할을 얻는 유일한 경로)
CREATE OR REPLACE FUNCTION public.claim_teacher_role(p_code TEXT)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_role TEXT;
  v_failures INT;
  v_code_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', '로그인이 필요합니다.');
  END IF;

  -- 같은 계정의 동시 요청을 직렬화해 시도 제한을 우회하지 못하게 함
  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', '프로필을 찾을 수 없습니다.');
  END IF;

  IF v_role = 'teacher' THEN
    RETURN json_build_object('success', true);
  END IF;

  IF v_role IS NOT NULL THEN
    RETURN json_build_object('success', false, 'message', '이미 학생으로 등록된 계정입니다.');
  END IF;

  SELECT count(*) INTO v_failures
  FROM public.teacher_code_attempts
  WHERE user_id = v_user_id
    AND NOT succeeded
    AND attempted_at > now() - interval '1 hour';

  IF v_failures >= 5 THEN
    RETURN json_build_object('success', false, 'message', '시도 횟수를 초과했습니다. 1시간 뒤에 다시 시도해 주세요.');
  END IF;

  IF length(COALESCE(p_code, '')) <= 64 THEN
    UPDATE public.teacher_codes
    SET used_count = used_count + 1
    WHERE code_hash = public.hash_teacher_code(p_code)
      AND revoked_at IS NULL
      AND expires_at > now()
      AND used_count < max_uses
    RETURNING id INTO v_code_id;
  END IF;

  IF v_code_id IS NULL THEN
    INSERT INTO public.teacher_code_attempts (user_id, succeeded)
    VALUES (v_user_id, false);
    RETURN json_build_object('success', false, 'message', '교사 인증 코드가 올바르지 않거나 만료되었습니다.');
  END IF;

  PERFORM set_config('app.role_change_allowed', 'on', true);
  UPDATE public.profiles SET role = 'teacher' WHERE id = v_user_id;
  PERFORM set_config('app.role_change_allowed', '', true);

  INSERT INTO public.teacher_code_attempts (user_id, code_id, succeeded)
  VALUES (v_user_id, v_code_id, true);

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.claim_teacher_role(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_teacher_role(TEXT) TO authenticated;

-- 6. 역할이 없는 계정(Google 가입 등)의 학생 역할 선택
CREATE OR REPLACE FUNCTION public.choose_student_role()
RETURNS JSON AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', '로그인이 필요합니다.');
  END IF;

  UPDATE public.profiles
  SET role = 'student'
  WHERE id = v_user_id AND role IS NULL;

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.choose_student_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.choose_student_role() TO authenticated;

-- 7. 관리자 전용 함수 (SQL Editor에서만 실행, API 역할의 실행 권한 없음)
CREATE OR REPLACE FUNCTION public.admin_create_teacher_code(
  p_label TEXT DEFAULT NULL,
  p_max_uses INT DEFAULT 30,
  p_valid_days INT DEFAULT 30
)
RETURNS JSON AS $$
DECLARE
  v_raw TEXT := upper(substr(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 1, 20));
  v_code TEXT;
  v_id UUID;
  v_expires_at TIMESTAMPTZ := now() + make_interval(days => p_valid_days);
BEGIN
  v_code := substr(v_raw, 1, 5) || '-' || substr(v_raw, 6, 5) || '-' || substr(v_raw, 11, 5) || '-' || substr(v_raw, 16, 5);

  INSERT INTO public.teacher_codes (code_hash, label, max_uses, expires_at)
  VALUES (public.hash_teacher_code(v_code), p_label, p_max_uses, v_expires_at)
  RETURNING id INTO v_id;

  -- 원문은 이 결과에서 한 번만 확인할 수 있음
  RETURN json_build_object('id', v_id, 'code', v_code, 'max_uses', p_max_uses, 'expires_at', v_expires_at);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.admin_disable_teacher_code(p_code_id UUID)
RETURNS JSON AS $$
BEGIN
  UPDATE public.teacher_codes
  SET revoked_at = now()
  WHERE id = p_code_id AND revoked_at IS NULL;

  RETURN json_build_object('disabled', FOUND);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 교사 권한을 회수합니다. 대표로 개설한 클래스는 자동 삭제하지 않고 목록으로 돌려줍니다.
CREATE OR REPLACE FUNCTION public.admin_revoke_teacher(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  v_removed_co_teaching INT;
  v_owned_classes JSON;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_user_id AND role = 'teacher'
  ) THEN
    RETURN json_build_object('error', '교사 계정이 아닙니다.');
  END IF;

  PERFORM set_config('app.role_change_allowed', 'on', true);
  UPDATE public.profiles SET role = 'student' WHERE id = p_user_id;
  PERFORM set_config('app.role_change_allowed', '', true);

  DELETE FROM public.class_teachers WHERE teacher_id = p_user_id;
  GET DIAGNOSTICS v_removed_co_teaching = ROW_COUNT;

  SELECT COALESCE(json_agg(json_build_object('id', id, 'name', name)), '[]'::json)
  INTO v_owned_classes
  FROM public.classes
  WHERE teacher_id = p_user_id
    AND name <> '__QCLASS_MATERIAL_LIBRARY__';

  RETURN json_build_object(
    'success', true,
    'removed_co_teaching', v_removed_co_teaching,
    'owned_classes_to_review', v_owned_classes
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.admin_create_teacher_code(TEXT, INT, INT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.admin_disable_teacher_code(UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.admin_revoke_teacher(UUID) FROM PUBLIC, anon, authenticated, service_role;

-- 8. 클래스 개설은 교사만, 대표 교사(teacher_id)는 변경 불가
DROP POLICY IF EXISTS "classes_insert_policy" ON public.classes;
CREATE POLICY "classes_insert_policy"
  ON public.classes
  FOR INSERT
  TO authenticated
  WITH CHECK (teacher_id = auth.uid() AND public.is_teacher());

CREATE OR REPLACE FUNCTION public.prevent_class_owner_change()
RETURNS trigger AS $$
BEGIN
  IF NEW.teacher_id IS DISTINCT FROM OLD.teacher_id THEN
    RAISE EXCEPTION '클래스 대표 교사는 변경할 수 없습니다.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_prevent_class_owner_change ON public.classes;
CREATE TRIGGER trg_prevent_class_owner_change
  BEFORE UPDATE ON public.classes
  FOR EACH ROW EXECUTE PROCEDURE public.prevent_class_owner_change();

-- 9. 수강 등록은 RPC로만 가능 (참여 코드 또는 담당 교사의 학생 추가)
DROP POLICY IF EXISTS "class_members_insert_policy" ON public.class_members;

-- 교사 계정은 수강생이 아니므로 남아 있는 폴백 레코드를 정리
DELETE FROM public.class_members cm
USING public.profiles p
WHERE cm.student_id = p.id AND p.role = 'teacher';

-- 10. 공동 교사 추가·해제는 대표 교사만, 공동 교사 본인은 나가기만 가능
DROP POLICY IF EXISTS "class_teachers_insert_policy" ON public.class_teachers;
DROP POLICY IF EXISTS "class_teachers_delete_policy" ON public.class_teachers;

CREATE POLICY "class_teachers_insert_policy"
  ON public.class_teachers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_teachers.class_id AND c.teacher_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = class_teachers.teacher_id AND p.role = 'teacher'
    )
  );

CREATE POLICY "class_teachers_delete_policy"
  ON public.class_teachers
  FOR DELETE
  TO authenticated
  USING (
    teacher_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_teachers.class_id AND c.teacher_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.teacher_invite_co_teacher(
  p_class_id UUID,
  p_identifier TEXT
)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
  v_clean_id TEXT;
  v_owner_id UUID;
  v_match_count INT;
  v_target_teacher_id UUID;
  v_target_teacher_name TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('error', '로그인이 필요합니다.');
  END IF;

  SELECT teacher_id INTO v_owner_id
  FROM public.classes
  WHERE id = p_class_id;

  IF v_owner_id IS NULL THEN
    RETURN json_build_object('error', '클래스 정보를 찾을 수 없습니다.');
  END IF;

  IF v_owner_id <> v_user_id THEN
    RETURN json_build_object('error', '클래스 대표 교사만 공동 교사를 초대할 수 있습니다.');
  END IF;

  v_clean_id := trim(COALESCE(p_identifier, ''));
  IF v_clean_id = '' THEN
    RETURN json_build_object('error', '초대할 선생님의 이메일 또는 이름을 입력해 주세요.');
  END IF;

  -- 1차: UUID 직접 일치 검사 (빠른 선택 목록에서 클릭한 경우)
  IF v_clean_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT p.id, COALESCE(p.name, split_part(u.email, '@', 1))
    INTO v_target_teacher_id, v_target_teacher_name
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    WHERE p.role = 'teacher'
      AND p.id = v_clean_id::uuid
    LIMIT 1;
  END IF;

  -- 2차: 이메일 정확 일치 검색 (auth.users + public.profiles)
  IF v_target_teacher_id IS NULL THEN
    SELECT p.id, COALESCE(p.name, split_part(u.email, '@', 1))
    INTO v_target_teacher_id, v_target_teacher_name
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE p.role = 'teacher'
      AND lower(u.email) = lower(v_clean_id)
    LIMIT 1;
  END IF;

  -- 3차: 이름 일치 검색
  IF v_target_teacher_id IS NULL THEN
    SELECT count(*)
    INTO v_match_count
    FROM public.profiles p
    WHERE p.role = 'teacher'
      AND lower(trim(p.name)) = lower(v_clean_id);

    IF v_match_count = 0 THEN
      RETURN json_build_object(
        'error',
        '일치하는 선생님 계정을 찾을 수 없습니다. 초대할 선생님이 교사 인증을 마쳤는지 이메일 또는 이름을 확인해 주세요.'
      );
    ELSIF v_match_count > 1 THEN
      RETURN json_build_object(
        'error',
        '동일한 성함의 선생님이 여러 분 계십니다. 정확한 이메일 주소로 입력해 주세요.'
      );
    END IF;

    SELECT p.id, p.name
    INTO v_target_teacher_id, v_target_teacher_name
    FROM public.profiles p
    WHERE p.role = 'teacher'
      AND lower(trim(p.name)) = lower(v_clean_id)
    LIMIT 1;
  END IF;

  IF v_target_teacher_id = v_owner_id THEN
    RETURN json_build_object('error', '이미 이 클래스를 개설한 대표 선생님입니다.');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.class_teachers
    WHERE class_id = p_class_id AND teacher_id = v_target_teacher_id
  ) THEN
    RETURN json_build_object('error', '이미 이 클래스에 팀티칭 교사로 참여 중인 선생님입니다.');
  END IF;

  INSERT INTO public.class_teachers (class_id, teacher_id, invited_by)
  VALUES (p_class_id, v_target_teacher_id, v_user_id);

  RETURN json_build_object(
    'success', true,
    'teacher_id', v_target_teacher_id,
    'teacher_name', v_target_teacher_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.teacher_remove_co_teacher(
  p_class_id UUID,
  p_teacher_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('error', '로그인이 필요합니다.');
  END IF;

  IF v_user_id <> p_teacher_id AND NOT EXISTS (
    SELECT 1 FROM public.classes
    WHERE id = p_class_id AND teacher_id = v_user_id
  ) THEN
    RETURN json_build_object('error', '클래스 대표 교사 또는 본인만 팀티칭을 해제할 수 있습니다.');
  END IF;

  DELETE FROM public.class_teachers
  WHERE class_id = p_class_id
    AND teacher_id = p_teacher_id;

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 11. 참여 코드는 학생 수강 등록 전용 (교사 계정은 공동 교사로 합류할 수 없음)
CREATE OR REPLACE FUNCTION public.join_class_by_code(p_join_code TEXT)
RETURNS JSON AS $$
DECLARE
  v_class_id UUID;
  v_class_name TEXT;
  v_user_id UUID := auth.uid();
  v_user_role TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', '로그인이 필요합니다.');
  END IF;

  SELECT role INTO v_user_role
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_user_role IS DISTINCT FROM 'student' THEN
    RETURN json_build_object('success', false, 'message', '학생 계정만 참여 코드로 수업에 등록할 수 있습니다.');
  END IF;

  p_join_code := UPPER(TRIM(p_join_code));

  IF p_join_code LIKE '#%' THEN
    RETURN json_build_object('success', false, 'message', '유효하지 않은 참여 코드입니다. 다시 확인해 주세요.');
  END IF;

  SELECT id, name
  INTO v_class_id, v_class_name
  FROM public.classes
  WHERE join_code = p_join_code;

  IF v_class_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', '유효하지 않은 참여 코드입니다. 다시 확인해 주세요.');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.class_members
    WHERE class_id = v_class_id AND student_id = v_user_id
  ) THEN
    RETURN json_build_object('success', true, 'class_id', v_class_id, 'class_name', v_class_name, 'already_joined', true, 'message', '이미 참여 중인 클래스입니다.');
  END IF;

  INSERT INTO public.class_members (class_id, student_id)
  VALUES (v_class_id, v_user_id);

  RETURN json_build_object('success', true, 'class_id', v_class_id, 'class_name', v_class_name, 'already_joined', false, 'message', '클래스에 성공적으로 참여했습니다.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.join_class_by_code(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_class_by_code(TEXT) TO authenticated;

COMMIT;

-- ==============================================================================
-- 운영 메모 (필요할 때 SQL Editor에서 실행)
--
-- 코드 발급: 결과의 code 값은 이때만 볼 수 있습니다.
--   SELECT public.admin_create_teacher_code('2026 교사용', 30, 30);
-- 코드 폐기:
--   SELECT public.admin_disable_teacher_code('<teacher_codes.id>');
-- 교사 목록 확인:
--   SELECT p.id, p.name, u.email, p.created_at
--   FROM public.profiles p JOIN auth.users u ON u.id = p.id
--   WHERE p.role = 'teacher' ORDER BY p.created_at DESC;
-- 공동 교사 점검: 초대자가 본인이면 예전 참여 코드 합류로 등록된 기록입니다.
--   SELECT ct.class_id, c.name AS class_name, ct.teacher_id, p.name, ct.invited_by, ct.created_at
--   FROM public.class_teachers ct
--   JOIN public.classes c ON c.id = ct.class_id
--   JOIN public.profiles p ON p.id = ct.teacher_id
--   ORDER BY ct.created_at DESC;
-- 교사 권한 회수:
--   SELECT public.admin_revoke_teacher('<profiles.id>');
-- ==============================================================================
