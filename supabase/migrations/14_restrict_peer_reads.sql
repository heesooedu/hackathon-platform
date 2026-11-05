-- ==============================================================================
-- 14_restrict_peer_reads.sql
-- 학생의 동료 원본 조회와 퀴즈 기록 직접 수정을 차단
--
-- 실행 순서: 13 적용 -> get_lesson_board를 쓰는 앱 배포 -> 이 파일 적용
-- 앱 배포 전에 실행하면 학생 화면에서 동료 질문과 퀴즈가 보이지 않습니다.
-- ==============================================================================

BEGIN;

-- 1. 제출물 원본: 본인과 담당 교사만 조회 (동료 화면은 get_lesson_board 사용)
DROP POLICY IF EXISTS "submissions_select_policy" ON public.submissions;
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
  );

-- 2. 퀴즈 그룹에는 정답이 들어 있으므로 학생의 직접 조회를 차단
DROP POLICY IF EXISTS "groups_select_policy" ON public.question_groups;
CREATE POLICY "groups_select_policy"
  ON public.question_groups
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.lessons l
      WHERE l.id = question_groups.lesson_id AND (
        public.is_class_teacher(l.class_id)
        OR (
          public.is_class_student(l.class_id)
          AND NOT public.is_quiz_group_title(question_groups.representative_title)
        )
      )
    )
  );

-- 3. 답변 원본: 본인과 담당 교사만 조회
DROP POLICY IF EXISTS "answers_select_policy" ON public.answers;
CREATE POLICY "answers_select_policy"
  ON public.answers
  FOR SELECT
  TO authenticated
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.question_groups qg
      JOIN public.lessons l ON l.id = qg.lesson_id
      WHERE qg.id = answers.group_id AND public.is_class_teacher(l.class_id)
    )
  );

-- 4. 학생은 일반 질문에만 답변을 쓰고, 퀴즈 기록은 채점 RPC로만 남김
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
      WHERE qg.id = answers.group_id AND (
        public.is_class_teacher(l.class_id)
        OR (
          public.is_class_student(l.class_id)
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
      JOIN public.lessons l ON l.id = qg.lesson_id
      WHERE qg.id = answers.group_id AND (
        public.is_class_teacher(l.class_id)
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
      JOIN public.lessons l ON l.id = qg.lesson_id
      WHERE qg.id = answers.group_id AND (
        public.is_class_teacher(l.class_id)
        OR (
          answers.author_id = auth.uid()
          AND public.is_class_student(l.class_id)
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
      JOIN public.lessons l ON l.id = qg.lesson_id
      WHERE qg.id = answers.group_id AND (
        public.is_class_teacher(l.class_id)
        OR (
          answers.author_id = auth.uid()
          AND NOT public.is_quiz_group_title(qg.representative_title)
        )
      )
    )
  );

COMMIT;
