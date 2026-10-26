-- ==============================================================================
-- 08_privacy_and_rls_hardening.sql
-- 개인정보 최소수집 및 최소권한(RLS) 강화 마이그레이션 (중복 실행 안전 버전)
-- ==============================================================================

-- 0. 기존 정책 일괄 정리 (중복 생성 오류 42710 원천 방지)
DO $$
BEGIN
  DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
  DROP POLICY IF EXISTS "profiles_select_minimal_policy" ON public.profiles;

  DROP POLICY IF EXISTS "classes_insert_policy" ON public.classes;
  DROP POLICY IF EXISTS "class_members_select_policy" ON public.class_members;

  DROP POLICY IF EXISTS "submissions_update_policy" ON public.submissions;
  DROP POLICY IF EXISTS "submissions_delete_policy" ON public.submissions;

  DROP POLICY IF EXISTS "group_members_select_policy" ON public.question_group_members;
  DROP POLICY IF EXISTS "group_members_insert_policy" ON public.question_group_members;
  DROP POLICY IF EXISTS "group_members_delete_policy" ON public.question_group_members;

  DROP POLICY IF EXISTS "answers_select_policy" ON public.answers;
  DROP POLICY IF EXISTS "answers_insert_policy" ON public.answers;
  DROP POLICY IF EXISTS "answers_update_policy" ON public.answers;
  DROP POLICY IF EXISTS "answers_delete_policy" ON public.answers;
END $$;

-- 1. 불필요하게 수집된 구글 프로필 사진(avatar_url) 일괄 비우기 및 가입 트리거에서 수집 제외
UPDATE public.profiles SET avatar_url = NULL WHERE avatar_url IS NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, role, name, avatar_url)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'role',
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

-- 1-1. 역할(role) 권한 상승(Privilege Escalation) 원천 차단 트리거
-- 한 번 'student' 또는 'teacher'로 설정된 역할은 사후에 변경할 수 없도록 DB 레벨에서 강제합니다.
CREATE OR REPLACE FUNCTION public.prevent_profile_role_change()
RETURNS trigger AS $$
BEGIN
  IF OLD.role IS NOT NULL AND NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION '한 번 설정된 역할(교사/학생)은 변경할 수 없습니다.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_prevent_profile_role_change ON public.profiles;
CREATE TRIGGER trg_prevent_profile_role_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.prevent_profile_role_change();

-- 2. 순환 참조 없는 최소권한 검사용 SECURITY DEFINER 보조 함수
CREATE OR REPLACE FUNCTION public.is_class_teacher(p_class_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classes
    WHERE id = p_class_id AND teacher_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_teacher_of_student(p_student_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.class_members cm
    JOIN public.classes c ON c.id = cm.class_id
    WHERE cm.student_id = p_student_id AND c.teacher_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- 3. profiles 조회 권한 최소화: 본인, 교사 프로필, 또는 내가 담당하는 학급의 학생 프로필만 조회 가능
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_minimal_policy" ON public.profiles;
CREATE POLICY "profiles_select_minimal_policy"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR role = 'teacher'
    OR public.is_teacher_of_student(id)
  );

-- 4. classes 생성 권한 및 class_members 조회 권한 최소화
DROP POLICY IF EXISTS "classes_insert_policy" ON public.classes;
CREATE POLICY "classes_insert_policy"
  ON public.classes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    teacher_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'teacher'
    )
  );

DROP POLICY IF EXISTS "class_members_select_policy" ON public.class_members;
CREATE POLICY "class_members_select_policy"
  ON public.class_members
  FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid()
    OR public.is_class_teacher(class_id)
  );

-- 4-1. 학생 6자리 코드 참여 RPC 강화 (교사 자료실 특수 코드 '#' 차단 및 search_path 고정)
CREATE OR REPLACE FUNCTION public.join_class_by_code(p_join_code TEXT)
RETURNS JSON AS $$
DECLARE
  v_class_id UUID;
  v_class_name TEXT;
  v_teacher_id UUID;
  v_student_id UUID := auth.uid();
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

  IF v_teacher_id = v_student_id THEN
    RETURN json_build_object('success', false, 'message', '선생님 본인이 개설한 클래스에는 학생으로 참여할 수 없습니다.');
  END IF;

  SELECT id INTO v_existing_id
  FROM public.class_members
  WHERE class_id = v_class_id AND student_id = v_student_id;

  IF v_existing_id IS NOT NULL THEN
    RETURN json_build_object('success', true, 'class_id', v_class_id, 'class_name', v_class_name, 'already_joined', true, 'message', '이미 참여 중인 클래스입니다.');
  END IF;

  INSERT INTO public.class_members (class_id, student_id)
  VALUES (v_class_id, v_student_id);

  RETURN json_build_object('success', true, 'class_id', v_class_id, 'class_name', v_class_name, 'already_joined', false, 'message', '클래스에 성공적으로 참여했습니다.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. submissions 수정/삭제 권한 강화: 수업이 열려 있을 때(마감 전)만 학생 본인이 수정/삭제 가능
DROP POLICY IF EXISTS "submissions_update_policy" ON public.submissions;
CREATE POLICY "submissions_update_policy"
  ON public.submissions
  FOR UPDATE
  TO authenticated
  USING (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.lessons l
      WHERE l.id = submissions.lesson_id
        AND l.status = 'open'
        AND (l.deadline IS NULL OR l.deadline > now())
    )
  )
  WITH CHECK (
    student_id = auth.uid()
  );

DROP POLICY IF EXISTS "submissions_delete_policy" ON public.submissions;
CREATE POLICY "submissions_delete_policy"
  ON public.submissions
  FOR DELETE
  TO authenticated
  USING (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.lessons l
      WHERE l.id = submissions.lesson_id
        AND l.status = 'open'
        AND (l.deadline IS NULL OR l.deadline > now())
    )
  );

-- 6. question_group_members 권한 최소화: 같은 반 구성원만 조회, 담당 교사만 질문 묶기/해제 가능
DROP POLICY IF EXISTS "group_members_select_policy" ON public.question_group_members;
CREATE POLICY "group_members_select_policy"
  ON public.question_group_members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.question_groups qg
      JOIN public.lessons l ON l.id = qg.lesson_id
      JOIN public.classes c ON c.id = l.class_id
      WHERE qg.id = question_group_members.group_id AND (
        c.teacher_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.class_members cm
          WHERE cm.class_id = c.id AND cm.student_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "group_members_insert_policy" ON public.question_group_members;
CREATE POLICY "group_members_insert_policy"
  ON public.question_group_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.question_groups qg
      JOIN public.lessons l ON l.id = qg.lesson_id
      JOIN public.classes c ON c.id = l.class_id
      WHERE qg.id = question_group_members.group_id AND c.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "group_members_delete_policy" ON public.question_group_members;
CREATE POLICY "group_members_delete_policy"
  ON public.question_group_members
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.question_groups qg
      JOIN public.lessons l ON l.id = qg.lesson_id
      JOIN public.classes c ON c.id = l.class_id
      WHERE qg.id = question_group_members.group_id AND c.teacher_id = auth.uid()
    )
  );

-- 7. answers 권한 최소화: 같은 반 구성원만 동료 답변 조회, 퀴즈 풀이 기록은 본인과 담당 교사만 조회 가능
DROP POLICY IF EXISTS "answers_select_policy" ON public.answers;
CREATE POLICY "answers_select_policy"
  ON public.answers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.question_groups qg
      JOIN public.lessons l ON l.id = qg.lesson_id
      JOIN public.classes c ON c.id = l.class_id
      WHERE qg.id = answers.group_id
        AND (
          c.teacher_id = auth.uid()
          OR (
            EXISTS (
              SELECT 1 FROM public.class_members cm
              WHERE cm.class_id = c.id AND cm.student_id = auth.uid()
            )
            AND (
              qg.representative_title NOT LIKE '[__QUIZ__]%'
              OR answers.author_id = auth.uid()
            )
          )
        )
    )
  );

DROP POLICY IF EXISTS "answers_insert_policy" ON public.answers;
CREATE POLICY "answers_insert_policy"
  ON public.answers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.question_groups qg
      JOIN public.lessons l ON l.id = qg.lesson_id
      JOIN public.classes c ON c.id = l.class_id
      WHERE qg.id = answers.group_id AND (
        c.teacher_id = auth.uid()
        OR (
          EXISTS (
            SELECT 1 FROM public.class_members cm
            WHERE cm.class_id = c.id AND cm.student_id = auth.uid()
          )
          AND (
            qg.representative_title LIKE '[__QUIZ__]%'
            OR answers.is_teacher_checked = false
          )
        )
      )
    )
  );

DROP POLICY IF EXISTS "answers_update_policy" ON public.answers;
CREATE POLICY "answers_update_policy"
  ON public.answers
  FOR UPDATE
  TO authenticated
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.question_groups qg
      JOIN public.lessons l ON l.id = qg.lesson_id
      JOIN public.classes c ON c.id = l.class_id
      WHERE qg.id = answers.group_id AND c.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.question_groups qg
      JOIN public.lessons l ON l.id = qg.lesson_id
      JOIN public.classes c ON c.id = l.class_id
      WHERE qg.id = answers.group_id AND (
        c.teacher_id = auth.uid()
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

DROP POLICY IF EXISTS "answers_delete_policy" ON public.answers;
CREATE POLICY "answers_delete_policy"
  ON public.answers
  FOR DELETE
  TO authenticated
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.question_groups qg
      JOIN public.lessons l ON l.id = qg.lesson_id
      JOIN public.classes c ON c.id = l.class_id
      WHERE qg.id = answers.group_id AND c.teacher_id = auth.uid()
    )
  );
