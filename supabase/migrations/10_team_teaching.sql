-- ==============================================================================
-- 10_team_teaching.sql
-- 팀티칭(공동 교사 초대 및 공동 수업 운영) 테이블, RLS 정책 확장 및 RPC 마이그레이션
-- ==============================================================================

-- 1. class_teachers 테이블 생성 (클래스별 공동 수업 교사 매핑)
CREATE TABLE IF NOT EXISTS public.class_teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(class_id, teacher_id)
);

CREATE INDEX IF NOT EXISTS idx_class_teachers_class_id ON public.class_teachers(class_id);
CREATE INDEX IF NOT EXISTS idx_class_teachers_teacher_id ON public.class_teachers(teacher_id);

ALTER TABLE public.class_teachers ENABLE ROW LEVEL SECURITY;

-- 1-1. 기존 class_members에 교사(role = 'teacher') 계정이 폴백으로 들어가 있던 경우 class_teachers로 자동 이관
INSERT INTO public.class_teachers (class_id, teacher_id, created_at)
SELECT cm.class_id, cm.student_id, cm.joined_at
FROM public.class_members cm
JOIN public.profiles p ON p.id = cm.student_id
WHERE p.role = 'teacher'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

DELETE FROM public.class_members cm
USING public.profiles p
WHERE cm.student_id = p.id AND p.role = 'teacher';

-- 2. 순환 참조 없는 최소권한 검사용 SECURITY DEFINER 보조 함수 업그레이드
-- 개설 교사(classes.teacher_id)뿐만 아니라 초대된 공동 교사(class_teachers.teacher_id)도 학급 교사로 인정
CREATE OR REPLACE FUNCTION public.is_class_teacher(p_class_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classes
    WHERE id = p_class_id AND teacher_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.class_teachers
    WHERE class_id = p_class_id AND teacher_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_teacher_of_student(p_student_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.class_members cm
    WHERE cm.student_id = p_student_id
      AND public.is_class_teacher(cm.class_id)
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- 3. class_teachers RLS 정책
DO $$
BEGIN
  DROP POLICY IF EXISTS "class_teachers_select_policy" ON public.class_teachers;
  DROP POLICY IF EXISTS "class_teachers_insert_policy" ON public.class_teachers;
  DROP POLICY IF EXISTS "class_teachers_delete_policy" ON public.class_teachers;
END $$;

CREATE POLICY "class_teachers_select_policy"
  ON public.class_teachers
  FOR SELECT
  TO authenticated
  USING (
    teacher_id = auth.uid()
    OR public.is_class_teacher(class_id)
    OR EXISTS (
      SELECT 1 FROM public.class_members cm
      WHERE cm.class_id = class_teachers.class_id AND cm.student_id = auth.uid()
    )
  );

CREATE POLICY "class_teachers_insert_policy"
  ON public.class_teachers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_class_teacher(class_id)
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
    OR public.is_class_teacher(class_id)
  );

-- 4. 기존 테이블 RLS 정책을 public.is_class_teacher() 기반으로 일괄 확장 (팀티칭 교사 공동 권한 부여)
DO $$
BEGIN
  DROP POLICY IF EXISTS "classes_select_policy" ON public.classes;
  DROP POLICY IF EXISTS "classes_update_policy" ON public.classes;

  DROP POLICY IF EXISTS "lessons_select_policy" ON public.lessons;
  DROP POLICY IF EXISTS "lessons_insert_policy" ON public.lessons;
  DROP POLICY IF EXISTS "lessons_update_policy" ON public.lessons;
  DROP POLICY IF EXISTS "lessons_delete_policy" ON public.lessons;

  DROP POLICY IF EXISTS "submissions_select_policy" ON public.submissions;

  DROP POLICY IF EXISTS "groups_select_policy" ON public.question_groups;
  DROP POLICY IF EXISTS "groups_insert_policy" ON public.question_groups;
  DROP POLICY IF EXISTS "groups_update_policy" ON public.question_groups;
  DROP POLICY IF EXISTS "groups_delete_policy" ON public.question_groups;

  DROP POLICY IF EXISTS "group_members_select_policy" ON public.question_group_members;
  DROP POLICY IF EXISTS "group_members_insert_policy" ON public.question_group_members;
  DROP POLICY IF EXISTS "group_members_delete_policy" ON public.question_group_members;

  DROP POLICY IF EXISTS "answers_select_policy" ON public.answers;
  DROP POLICY IF EXISTS "answers_insert_policy" ON public.answers;
  DROP POLICY IF EXISTS "answers_update_policy" ON public.answers;
  DROP POLICY IF EXISTS "answers_delete_policy" ON public.answers;

  DROP POLICY IF EXISTS "quizzes_select_policy" ON public.formative_quizzes;
  DROP POLICY IF EXISTS "quizzes_insert_policy" ON public.formative_quizzes;
  DROP POLICY IF EXISTS "quizzes_update_policy" ON public.formative_quizzes;
  DROP POLICY IF EXISTS "quizzes_delete_policy" ON public.formative_quizzes;

  DROP POLICY IF EXISTS "attempts_select_policy" ON public.quiz_attempts;
END $$;

-- 4-1. classes 정책 (삭제는 최초 개설 교사만 가능, 조회 및 수정은 공동 교사도 가능)
CREATE POLICY "classes_select_policy"
  ON public.classes
  FOR SELECT
  TO authenticated
  USING (
    public.is_class_teacher(id)
    OR EXISTS (
      SELECT 1 FROM public.class_members cm
      WHERE cm.class_id = classes.id AND cm.student_id = auth.uid()
    )
  );

CREATE POLICY "classes_update_policy"
  ON public.classes
  FOR UPDATE
  TO authenticated
  USING (public.is_class_teacher(id))
  WITH CHECK (public.is_class_teacher(id));

-- 4-2. lessons 정책
CREATE POLICY "lessons_select_policy"
  ON public.lessons
  FOR SELECT
  TO authenticated
  USING (
    public.is_class_teacher(class_id)
    OR EXISTS (
      SELECT 1 FROM public.class_members cm
      WHERE cm.class_id = lessons.class_id AND cm.student_id = auth.uid()
    )
  );

CREATE POLICY "lessons_insert_policy"
  ON public.lessons
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_class_teacher(class_id));

CREATE POLICY "lessons_update_policy"
  ON public.lessons
  FOR UPDATE
  TO authenticated
  USING (public.is_class_teacher(class_id))
  WITH CHECK (public.is_class_teacher(class_id));

CREATE POLICY "lessons_delete_policy"
  ON public.lessons
  FOR DELETE
  TO authenticated
  USING (public.is_class_teacher(class_id));

-- 4-3. submissions 조회 정책
CREATE POLICY "submissions_select_policy"
  ON public.submissions
  FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.lessons l
      WHERE l.id = submissions.lesson_id AND public.is_class_teacher(l.class_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.lessons l
      JOIN public.class_members cm ON cm.class_id = l.class_id
      WHERE l.id = submissions.lesson_id AND cm.student_id = auth.uid()
    )
  );

-- 4-4. question_groups 정책
CREATE POLICY "groups_select_policy"
  ON public.question_groups
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.lessons l
      WHERE l.id = question_groups.lesson_id AND (
        public.is_class_teacher(l.class_id)
        OR EXISTS (
          SELECT 1 FROM public.class_members cm
          WHERE cm.class_id = l.class_id AND cm.student_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "groups_insert_policy"
  ON public.question_groups
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lessons l
      WHERE l.id = question_groups.lesson_id AND public.is_class_teacher(l.class_id)
    )
  );

CREATE POLICY "groups_update_policy"
  ON public.question_groups
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.lessons l
      WHERE l.id = question_groups.lesson_id AND public.is_class_teacher(l.class_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lessons l
      WHERE l.id = question_groups.lesson_id AND public.is_class_teacher(l.class_id)
    )
  );

CREATE POLICY "groups_delete_policy"
  ON public.question_groups
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.lessons l
      WHERE l.id = question_groups.lesson_id AND public.is_class_teacher(l.class_id)
    )
  );

-- 4-5. question_group_members 정책
CREATE POLICY "group_members_select_policy"
  ON public.question_group_members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.question_groups qg
      JOIN public.lessons l ON l.id = qg.lesson_id
      WHERE qg.id = question_group_members.group_id AND (
        public.is_class_teacher(l.class_id)
        OR EXISTS (
          SELECT 1 FROM public.class_members cm
          WHERE cm.class_id = l.class_id AND cm.student_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "group_members_insert_policy"
  ON public.question_group_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.question_groups qg
      JOIN public.lessons l ON l.id = qg.lesson_id
      WHERE qg.id = question_group_members.group_id AND public.is_class_teacher(l.class_id)
    )
  );

CREATE POLICY "group_members_delete_policy"
  ON public.question_group_members
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.question_groups qg
      JOIN public.lessons l ON l.id = qg.lesson_id
      WHERE qg.id = question_group_members.group_id AND public.is_class_teacher(l.class_id)
    )
  );

-- 4-6. answers 정책
CREATE POLICY "answers_select_policy"
  ON public.answers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.question_groups qg
      JOIN public.lessons l ON l.id = qg.lesson_id
      WHERE qg.id = answers.group_id
        AND (
          public.is_class_teacher(l.class_id)
          OR (
            EXISTS (
              SELECT 1 FROM public.class_members cm
              WHERE cm.class_id = l.class_id AND cm.student_id = auth.uid()
            )
            AND (
              qg.representative_title NOT LIKE '[__QUIZ__]%'
              OR answers.author_id = auth.uid()
            )
          )
        )
    )
  );

CREATE POLICY "answers_insert_policy"
  ON public.answers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.question_groups qg
      JOIN public.lessons l ON l.id = qg.lesson_id
      WHERE qg.id = answers.group_id AND (
        public.is_class_teacher(l.class_id)
        OR (
          EXISTS (
            SELECT 1 FROM public.class_members cm
            WHERE cm.class_id = l.class_id AND cm.student_id = auth.uid()
          )
          AND (
            qg.representative_title LIKE '[__QUIZ__]%'
            OR answers.is_teacher_checked = false
          )
        )
      )
    )
  );

CREATE POLICY "answers_update_policy"
  ON public.answers
  FOR UPDATE
  TO authenticated
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.question_groups qg
      JOIN public.lessons l ON l.id = qg.lesson_id
      WHERE qg.id = answers.group_id AND public.is_class_teacher(l.class_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.question_groups qg
      JOIN public.lessons l ON l.id = qg.lesson_id
      WHERE qg.id = answers.group_id AND (
        public.is_class_teacher(l.class_id)
        OR (
          answers.author_id = auth.uid()
          AND (
            qg.representative_title LIKE '[__QUIZ__]%'
            OR answers.is_teacher_checked = false
          )
        )
      )
    )
  );

CREATE POLICY "answers_delete_policy"
  ON public.answers
  FOR DELETE
  TO authenticated
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.question_groups qg
      JOIN public.lessons l ON l.id = qg.lesson_id
      WHERE qg.id = answers.group_id AND public.is_class_teacher(l.class_id)
    )
  );

-- 4-7. formative_quizzes 및 quiz_attempts 정책
CREATE POLICY "quizzes_select_policy"
  ON public.formative_quizzes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.lessons l
      WHERE l.id = formative_quizzes.lesson_id AND (
        public.is_class_teacher(l.class_id)
        OR EXISTS (
          SELECT 1 FROM public.class_members cm
          WHERE cm.class_id = l.class_id AND cm.student_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "quizzes_insert_policy"
  ON public.formative_quizzes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lessons l
      WHERE l.id = formative_quizzes.lesson_id AND public.is_class_teacher(l.class_id)
    )
  );

CREATE POLICY "quizzes_update_policy"
  ON public.formative_quizzes
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.lessons l
      WHERE l.id = formative_quizzes.lesson_id AND public.is_class_teacher(l.class_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lessons l
      WHERE l.id = formative_quizzes.lesson_id AND public.is_class_teacher(l.class_id)
    )
  );

CREATE POLICY "quizzes_delete_policy"
  ON public.formative_quizzes
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.lessons l
      WHERE l.id = formative_quizzes.lesson_id AND public.is_class_teacher(l.class_id)
    )
  );

CREATE POLICY "attempts_select_policy"
  ON public.quiz_attempts
  FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.lessons l
      WHERE l.id = quiz_attempts.lesson_id AND public.is_class_teacher(l.class_id)
    )
  );

-- 5. 교사가 동료 교사의 이메일 또는 이름으로 클래스 팀티칭에 초대하는 SECURITY DEFINER RPC 함수
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

  IF NOT public.is_class_teacher(p_class_id) THEN
    RETURN json_build_object('error', '해당 클래스의 담당 교사만 팀티칭 교사를 초대할 수 있습니다.');
  END IF;

  SELECT teacher_id INTO v_owner_id
  FROM public.classes
  WHERE id = p_class_id;

  IF v_owner_id IS NULL THEN
    RETURN json_build_object('error', '클래스 정보를 찾을 수 없습니다.');
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
        '일치하는 선생님 계정을 찾을 수 없습니다. 초대할 선생님이 교사 역할로 가입했는지 이메일 또는 이름을 확인해 주세요.'
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

  -- 혹시 class_members에 남아 있던 폴백 레코드가 있다면 정리
  DELETE FROM public.class_members
  WHERE class_id = p_class_id AND student_id = v_target_teacher_id;

  RETURN json_build_object(
    'success', true,
    'teacher_id', v_target_teacher_id,
    'teacher_name', v_target_teacher_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.teacher_invite_co_teacher(UUID, TEXT) TO authenticated;

-- 6. 팀티칭 공동 교사 제외 또는 자진 나가기 SECURITY DEFINER RPC 함수
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

  IF v_user_id <> p_teacher_id AND NOT public.is_class_teacher(p_class_id) THEN
    RETURN json_build_object('error', '공동 교사를 해제할 권한이 없습니다.');
  END IF;

  DELETE FROM public.class_teachers
  WHERE class_id = p_class_id
    AND teacher_id = p_teacher_id;

  DELETE FROM public.class_members
  WHERE class_id = p_class_id
    AND student_id = p_teacher_id;

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.teacher_remove_co_teacher(UUID, UUID) TO authenticated;

-- 7. 6자리 참여 코드 입력 시: 학생이면 수강생(class_members)으로, 교사이면 팀티칭 공동 교사(class_teachers)로 자동 참여
CREATE OR REPLACE FUNCTION public.join_class_by_code(p_join_code TEXT)
RETURNS JSON AS $$
DECLARE
  v_class_id UUID;
  v_class_name TEXT;
  v_teacher_id UUID;
  v_user_id UUID := auth.uid();
  v_user_role TEXT;
  v_existing_id UUID;
BEGIN
  p_join_code := UPPER(TRIM(p_join_code));

  IF p_join_code LIKE '#%' THEN
    RETURN json_build_object('success', false, 'message', '유효하지 않은 참여 코드입니다. 다시 확인해 주세요.');
  END IF;

  SELECT id, name, teacher_id
  INTO v_class_id, v_class_name, v_teacher_id
  FROM public.classes
  WHERE join_code = p_join_code;

  IF v_class_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', '유효하지 않은 참여 코드입니다. 다시 확인해 주세요.');
  END IF;

  SELECT role INTO v_user_role
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_teacher_id = v_user_id THEN
    RETURN json_build_object('success', false, 'message', '선생님 본인이 개설한 클래스입니다.');
  END IF;

  -- 교사 계정인 경우 팀티칭 공동 교사로 등록
  IF v_user_role = 'teacher' THEN
    SELECT id INTO v_existing_id
    FROM public.class_teachers
    WHERE class_id = v_class_id AND teacher_id = v_user_id;

    IF v_existing_id IS NOT NULL THEN
      RETURN json_build_object('success', true, 'class_id', v_class_id, 'class_name', v_class_name, 'already_joined', true, 'message', '이미 팀티칭 교사로 참여 중인 클래스입니다.');
    END IF;

    INSERT INTO public.class_teachers (class_id, teacher_id, invited_by)
    VALUES (v_class_id, v_user_id, v_teacher_id);

    RETURN json_build_object('success', true, 'class_id', v_class_id, 'class_name', v_class_name, 'already_joined', false, 'message', '팀티칭 공동 교사로 클래스에 합류했습니다.');
  END IF;

  -- 학생 계정인 경우 수강생으로 등록
  SELECT id INTO v_existing_id
  FROM public.class_members
  WHERE class_id = v_class_id AND student_id = v_user_id;

  IF v_existing_id IS NOT NULL THEN
    RETURN json_build_object('success', true, 'class_id', v_class_id, 'class_name', v_class_name, 'already_joined', true, 'message', '이미 참여 중인 클래스입니다.');
  END IF;

  INSERT INTO public.class_members (class_id, student_id)
  VALUES (v_class_id, v_user_id);

  RETURN json_build_object('success', true, 'class_id', v_class_id, 'class_name', v_class_name, 'already_joined', false, 'message', '클래스에 성공적으로 참여했습니다.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
