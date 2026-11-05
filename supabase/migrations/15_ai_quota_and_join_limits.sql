-- ==============================================================================
-- 15_ai_quota_and_join_limits.sql
-- AI 호출 사용량 제한, 참여 코드 시도 제한, 학생 직접 등록의 이름 검색 제거
--
-- 이 파일은 기존 앱과 함께 동작합니다. consume_ai_quota를 쓰는 앱은 이 파일을 적용한 뒤 배포합니다.
-- ==============================================================================

BEGIN;

-- 1. AI 호출 사용량 제한 (Vercel 함수는 메모리를 공유하지 않으므로 DB에서 집계)
CREATE TABLE IF NOT EXISTS public.ai_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_user_created
  ON public.ai_usage_events(user_id, created_at DESC);

-- 정책을 두지 않아 API로는 읽거나 쓸 수 없고, 아래 함수로만 기록됨
ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_usage_events FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_ai_quota(p_kind TEXT)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_role TEXT;
  v_hourly INT;
  v_daily INT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('allowed', false, 'message', '로그인이 필요합니다.');
  END IF;

  -- 같은 계정의 동시 요청을 직렬화해 제한을 우회하지 못하게 함
  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF v_role IS DISTINCT FROM 'teacher' THEN
    RETURN json_build_object('allowed', false, 'message', '선생님 계정만 AI 기능을 사용할 수 있습니다.');
  END IF;

  SELECT
    count(*) FILTER (WHERE created_at > now() - interval '1 hour'),
    count(*)
  INTO v_hourly, v_daily
  FROM public.ai_usage_events
  WHERE user_id = v_user_id
    AND created_at > now() - interval '1 day';

  IF v_hourly >= 30 THEN
    RETURN json_build_object('allowed', false, 'message', 'AI 기능 사용량이 많습니다. 1시간 뒤에 다시 시도해 주세요.');
  END IF;

  IF v_daily >= 100 THEN
    RETURN json_build_object('allowed', false, 'message', '오늘 AI 기능 사용 한도에 도달했습니다. 내일 다시 시도해 주세요.');
  END IF;

  INSERT INTO public.ai_usage_events (user_id, kind)
  VALUES (v_user_id, left(COALESCE(p_kind, 'unknown'), 40));

  DELETE FROM public.ai_usage_events
  WHERE user_id = v_user_id
    AND created_at < now() - interval '7 days';

  RETURN json_build_object('allowed', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.consume_ai_quota(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_ai_quota(TEXT) TO authenticated;

-- 2. 참여 코드 시도 제한
CREATE TABLE IF NOT EXISTS public.join_code_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_join_code_attempts_user_time
  ON public.join_code_attempts(user_id, attempted_at DESC);

ALTER TABLE public.join_code_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.join_code_attempts FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.join_class_by_code(p_join_code TEXT)
RETURNS JSON AS $$
DECLARE
  v_class_id UUID;
  v_class_name TEXT;
  v_user_id UUID := auth.uid();
  v_user_role TEXT;
  v_failures INT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', '로그인이 필요합니다.');
  END IF;

  -- 같은 계정의 동시 요청을 직렬화해 시도 제한을 우회하지 못하게 함
  SELECT role INTO v_user_role
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF v_user_role IS DISTINCT FROM 'student' THEN
    RETURN json_build_object('success', false, 'message', '학생 계정만 참여 코드로 수업에 등록할 수 있습니다.');
  END IF;

  SELECT count(*) INTO v_failures
  FROM public.join_code_attempts
  WHERE user_id = v_user_id
    AND attempted_at > now() - interval '1 hour';

  IF v_failures >= 10 THEN
    RETURN json_build_object('success', false, 'message', '시도 횟수를 초과했습니다. 1시간 뒤에 다시 시도해 주세요.');
  END IF;

  p_join_code := UPPER(TRIM(p_join_code));

  IF p_join_code NOT LIKE '#%' THEN
    SELECT id, name
    INTO v_class_id, v_class_name
    FROM public.classes
    WHERE join_code = p_join_code;
  END IF;

  IF v_class_id IS NULL THEN
    INSERT INTO public.join_code_attempts (user_id) VALUES (v_user_id);
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

-- 3. 학생 직접 등록은 이메일 일치만 허용
-- 이름 검색은 가입자 이름을 추측하는 데 쓰일 수 있고, 동명이인을 잘못 등록할 위험이 있음
CREATE OR REPLACE FUNCTION public.teacher_add_student_to_class(
  p_class_id UUID,
  p_identifier TEXT
)
RETURNS JSON AS $$
DECLARE
  v_clean_id TEXT := trim(COALESCE(p_identifier, ''));
  v_student_id UUID;
  v_student_name TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('error', '로그인이 필요합니다.');
  END IF;

  IF NOT public.is_class_teacher(p_class_id) THEN
    RETURN json_build_object('error', '해당 클래스의 담당 교사만 학생을 추가할 수 있습니다.');
  END IF;

  IF v_clean_id = '' THEN
    RETURN json_build_object('error', '추가할 학생의 이메일을 입력해 주세요.');
  END IF;

  SELECT p.id, COALESCE(p.name, split_part(u.email, '@', 1))
  INTO v_student_id, v_student_name
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.role = 'student'
    AND lower(u.email) = lower(v_clean_id)
  LIMIT 1;

  IF v_student_id IS NULL THEN
    RETURN json_build_object(
      'error',
      '일치하는 학생 계정을 찾을 수 없습니다. 학생의 가입 이메일을 확인하거나 참여 코드를 공유해 주세요.'
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.class_members
    WHERE class_id = p_class_id AND student_id = v_student_id
  ) THEN
    RETURN json_build_object('error', '이미 이 클래스에 등록되어 있는 학생입니다.');
  END IF;

  INSERT INTO public.class_members (class_id, student_id)
  VALUES (p_class_id, v_student_id);

  RETURN json_build_object(
    'success', true,
    'student_id', v_student_id,
    'student_name', v_student_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.teacher_add_student_to_class(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.teacher_add_student_to_class(UUID, TEXT) TO authenticated;

COMMIT;
