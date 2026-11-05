-- ==============================================================================
-- 12_short_teacher_codes.sql
-- 교사 인증 코드를 6자리 숫자로 단축하고, 짧은 코드에 맞게 추측 방어를 강화
--
-- 6자리는 경우의 수가 100만 개뿐이므로 다음 세 가지를 함께 적용합니다.
-- - 계정별 제한 외에 서비스 전체의 실패 횟수를 제한
-- - 유효 기간 기본값을 7일로 단축
-- - 새 코드를 발급하면 기존 활성 코드를 폐기해 유효한 코드를 하나만 유지
-- ==============================================================================

BEGIN;

CREATE INDEX IF NOT EXISTS idx_teacher_code_attempts_failed_at
  ON public.teacher_code_attempts(attempted_at DESC)
  WHERE NOT succeeded;

CREATE OR REPLACE FUNCTION public.claim_teacher_role(p_code TEXT)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_role TEXT;
  v_failures INT;
  v_global_failures INT;
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

  -- 계정을 여러 개 만들어 코드를 맞히는 시도를 막는 서비스 전체 제한
  SELECT count(*) INTO v_global_failures
  FROM public.teacher_code_attempts
  WHERE NOT succeeded
    AND attempted_at > now() - interval '1 hour';

  IF v_global_failures >= 30 THEN
    RETURN json_build_object('success', false, 'message', '지금은 교사 인증을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.');
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

CREATE OR REPLACE FUNCTION public.admin_create_teacher_code(
  p_label TEXT DEFAULT NULL,
  p_max_uses INT DEFAULT 30,
  p_valid_days INT DEFAULT 7
)
RETURNS JSON AS $$
DECLARE
  v_code TEXT;
  v_hash TEXT;
  v_id UUID;
  v_expires_at TIMESTAMPTZ := now() + make_interval(days => p_valid_days);
BEGIN
  -- 유효한 코드가 늘수록 맞힐 확률이 커지므로 기존 활성 코드를 폐기
  UPDATE public.teacher_codes
  SET revoked_at = now()
  WHERE revoked_at IS NULL;

  -- 예전에 쓴 번호와 겹치면 다시 생성 (code_hash는 UNIQUE)
  LOOP
    v_code := lpad(
      ((('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::bigint) % 1000000)::text,
      6,
      '0'
    );
    v_hash := public.hash_teacher_code(v_code);
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.teacher_codes WHERE code_hash = v_hash
    );
  END LOOP;

  INSERT INTO public.teacher_codes (code_hash, label, max_uses, expires_at)
  VALUES (v_hash, p_label, p_max_uses, v_expires_at)
  RETURNING id INTO v_id;

  -- 원문은 이 결과에서 한 번만 확인할 수 있음
  RETURN json_build_object('id', v_id, 'code', v_code, 'max_uses', p_max_uses, 'expires_at', v_expires_at);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.admin_create_teacher_code(TEXT, INT, INT) FROM PUBLIC, anon, authenticated, service_role;

COMMIT;

-- 코드 발급: 이전 코드는 자동 폐기되고, 새 코드는 결과의 code 값에서 한 번만 볼 수 있습니다.
--   SELECT public.admin_create_teacher_code('교사용', 30, 7);
