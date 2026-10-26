-- ==============================================================================
-- 09_teacher_student_management.sql
-- 교사용 학급 학생 수동 추가(이메일/이름 기반) 및 클래스 제외(삭제) 권한 & RPC 마이그레이션
-- ==============================================================================

-- 1. class_members 테이블의 INSERT / DELETE 정책에 담당 교사 권한(is_class_teacher) 추가
DO $$
BEGIN
  DROP POLICY IF EXISTS "class_members_insert_policy" ON public.class_members;
  DROP POLICY IF EXISTS "class_members_delete_policy" ON public.class_members;
END $$;

CREATE POLICY "class_members_insert_policy"
  ON public.class_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    OR public.is_class_teacher(class_id)
  );

CREATE POLICY "class_members_delete_policy"
  ON public.class_members
  FOR DELETE
  TO authenticated
  USING (
    student_id = auth.uid()
    OR public.is_class_teacher(class_id)
  );

-- 2. 교사가 학생의 이메일 또는 이름으로 학급에 직접 등록하는 SECURITY DEFINER RPC 함수
CREATE OR REPLACE FUNCTION public.teacher_add_student_to_class(
  p_class_id UUID,
  p_identifier TEXT
)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
  v_clean_id TEXT;
  v_match_count INT;
  v_student_id UUID;
  v_student_name TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('error', '로그인이 필요합니다.');
  END IF;

  -- 담당 교사 여부 확인
  IF NOT public.is_class_teacher(p_class_id) THEN
    RETURN json_build_object('error', '해당 클래스의 담당 교사만 학생을 추가할 수 있습니다.');
  END IF;

  v_clean_id := trim(COALESCE(p_identifier, ''));
  IF v_clean_id = '' THEN
    RETURN json_build_object('error', '추가할 학생의 이메일 또는 이름을 입력해 주세요.');
  END IF;

  -- 1차: 이메일 정확 일치 검색 (auth.users + public.profiles)
  SELECT p.id, COALESCE(p.name, split_part(u.email, '@', 1))
  INTO v_student_id, v_student_name
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.role = 'student'
    AND lower(u.email) = lower(v_clean_id)
  LIMIT 1;

  -- 2차: 이메일로 못 찾은 경우 이름 일치 검색
  IF v_student_id IS NULL THEN
    SELECT count(*)
    INTO v_match_count
    FROM public.profiles p
    WHERE p.role = 'student'
      AND lower(trim(p.name)) = lower(v_clean_id);

    IF v_match_count = 0 THEN
      RETURN json_build_object(
        'error',
        '일치하는 학생 계정을 찾을 수 없습니다. 학생이 먼저 가입했는지 이메일 또는 이름을 확인해 주세요.'
      );
    ELSIF v_match_count > 1 THEN
      RETURN json_build_object(
        'error',
        '동일한 이름의 학생이 여러 명 존재합니다. 정확한 학생 이메일 주소로 입력해 주세요.'
      );
    END IF;

    SELECT p.id, p.name
    INTO v_student_id, v_student_name
    FROM public.profiles p
    WHERE p.role = 'student'
      AND lower(trim(p.name)) = lower(v_clean_id)
    LIMIT 1;
  END IF;

  -- 이미 등록된 학생인지 확인
  IF EXISTS (
    SELECT 1 FROM public.class_members
    WHERE class_id = p_class_id AND student_id = v_student_id
  ) THEN
    RETURN json_build_object('error', '이미 이 클래스에 등록되어 있는 학생입니다.');
  END IF;

  -- 클래스 멤버로 등록
  INSERT INTO public.class_members (class_id, student_id)
  VALUES (p_class_id, v_student_id);

  RETURN json_build_object(
    'success', true,
    'student_id', v_student_id,
    'student_name', v_student_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.teacher_add_student_to_class(UUID, TEXT) TO authenticated;

-- 3. 교사가 학급에서 학생을 제외(등록 해제)하는 SECURITY DEFINER RPC 함수
-- (AGENTS.md 불변성 원칙에 따라 학생의 기존 질문/답변 기록은 삭제하지 않고 수강 명단에서만 제외)
CREATE OR REPLACE FUNCTION public.teacher_remove_student_from_class(
  p_class_id UUID,
  p_student_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('error', '로그인이 필요합니다.');
  END IF;

  IF NOT public.is_class_teacher(p_class_id) THEN
    RETURN json_build_object('error', '해당 클래스의 담당 교사만 학생을 제외할 수 있습니다.');
  END IF;

  DELETE FROM public.class_members
  WHERE class_id = p_class_id
    AND student_id = p_student_id;

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.teacher_remove_student_from_class(UUID, UUID) TO authenticated;
