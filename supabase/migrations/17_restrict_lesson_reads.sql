-- ==============================================================================
-- 17_restrict_lesson_reads.sql
-- 학생의 lessons 직접 조회를 차단 (교안 원문에 정답과 AI 리포트가 들어 있음)
--
-- 실행 순서: 16 적용 -> get_student_lesson을 쓰는 앱 배포 -> 이 파일 적용
-- 앱 배포 전에 실행하면 학생 화면에서 수업이 보이지 않습니다.
--
-- 학생 권한으로 평가되는 정책 안의 lessons 조회는 이 변경 뒤 항상 비어 있게 되므로,
-- 같은 내용의 정책을 SECURITY DEFINER 보조 함수를 쓰도록 다시 만듭니다.
-- ==============================================================================

BEGIN;

DROP POLICY IF EXISTS "lessons_select_policy" ON public.lessons;
CREATE POLICY "lessons_select_policy"
  ON public.lessons
  FOR SELECT
  TO authenticated
  USING (public.is_class_teacher(class_id));

-- submissions
DROP POLICY IF EXISTS "submissions_select_policy" ON public.submissions;
CREATE POLICY "submissions_select_policy"
  ON public.submissions
  FOR SELECT
  TO authenticated
  USING (student_id = auth.uid() OR public.is_lesson_teacher(lesson_id));

DROP POLICY IF EXISTS "submissions_insert_policy" ON public.submissions;
CREATE POLICY "submissions_insert_policy"
  ON public.submissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND public.is_lesson_open(lesson_id)
    AND public.is_lesson_student(lesson_id)
  );

DROP POLICY IF EXISTS "submissions_update_policy" ON public.submissions;
CREATE POLICY "submissions_update_policy"
  ON public.submissions
  FOR UPDATE
  TO authenticated
  USING (
    student_id = auth.uid()
    AND public.is_lesson_open(lesson_id)
    AND public.is_lesson_student(lesson_id)
  )
  WITH CHECK (student_id = auth.uid());

-- question_groups
DROP POLICY IF EXISTS "groups_select_policy" ON public.question_groups;
CREATE POLICY "groups_select_policy"
  ON public.question_groups
  FOR SELECT
  TO authenticated
  USING (
    public.is_lesson_teacher(lesson_id)
    OR (
      public.is_lesson_student(lesson_id)
      AND NOT public.is_quiz_group_title(representative_title)
    )
  );

-- question_group_members
DROP POLICY IF EXISTS "group_members_select_policy" ON public.question_group_members;
CREATE POLICY "group_members_select_policy"
  ON public.question_group_members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.question_groups qg
      WHERE qg.id = question_group_members.group_id
    )
  );

-- answers (학생에게 퀴즈 그룹은 보이지 않으므로 아래 EXISTS에서 자동으로 제외됨)
DROP POLICY IF EXISTS "answers_select_policy" ON public.answers;
CREATE POLICY "answers_select_policy"
  ON public.answers
  FOR SELECT
  TO authenticated
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.question_groups qg
      WHERE qg.id = answers.group_id AND public.is_lesson_teacher(qg.lesson_id)
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
      WHERE qg.id = answers.group_id AND (
        public.is_lesson_teacher(qg.lesson_id)
        OR (
          public.is_lesson_student(qg.lesson_id)
          AND NOT public.is_quiz_group_title(qg.representative_title)
          AND answers.is_teacher_checked = false
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
    EXISTS (
      SELECT 1 FROM public.question_groups qg
      WHERE qg.id = answers.group_id AND (
        public.is_lesson_teacher(qg.lesson_id)
        OR (
          answers.author_id = auth.uid()
          AND NOT public.is_quiz_group_title(qg.representative_title)
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.question_groups qg
      WHERE qg.id = answers.group_id AND (
        public.is_lesson_teacher(qg.lesson_id)
        OR (
          answers.author_id = auth.uid()
          AND public.is_lesson_student(qg.lesson_id)
          AND NOT public.is_quiz_group_title(qg.representative_title)
          AND answers.is_teacher_checked = false
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
    EXISTS (
      SELECT 1 FROM public.question_groups qg
      WHERE qg.id = answers.group_id AND (
        public.is_lesson_teacher(qg.lesson_id)
        OR (
          answers.author_id = auth.uid()
          AND NOT public.is_quiz_group_title(qg.representative_title)
        )
      )
    )
  );

COMMIT;
