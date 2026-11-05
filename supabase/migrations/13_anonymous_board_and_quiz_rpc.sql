-- ==============================================================================
-- 13_anonymous_board_and_quiz_rpc.sql
-- 학생용 익명 조회 RPC와 서버 채점 RPC를 추가하고, 제출 마감을 DB에서 강제
--
-- 이 파일은 기존 앱과 함께 동작합니다. 기존 조회 권한을 줄이는 작업은
-- 새 앱이 배포된 뒤 14_restrict_peer_reads.sql에서 진행합니다.
-- ==============================================================================

BEGIN;

-- 1. 정책과 RPC에서 쓰는 보조 함수
CREATE OR REPLACE FUNCTION public.is_class_student(p_class_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.class_members
    WHERE class_id = p_class_id AND student_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_lesson_open(p_lesson_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.lessons
    WHERE id = p_lesson_id
      AND status = 'open'
      AND (deadline IS NULL OR deadline > now())
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_quiz_group_title(p_title TEXT)
RETURNS BOOLEAN AS $$
  SELECT starts_with(p_title, '[__QUIZ__]')
    OR starts_with(p_title, '[__INLINE_QUIZ__]');
$$ LANGUAGE sql IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.safe_jsonb(p_value TEXT)
RETURNS JSONB AS $$
BEGIN
  RETURN p_value::jsonb;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

REVOKE ALL ON FUNCTION public.is_class_student(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_lesson_open(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_quiz_group_title(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.safe_jsonb(TEXT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_class_student(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_lesson_open(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_quiz_group_title(TEXT) TO authenticated;

-- 2. 제출 마감과 소속을 DB에서 강제
DROP POLICY IF EXISTS "submissions_insert_policy" ON public.submissions;
CREATE POLICY "submissions_insert_policy"
  ON public.submissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND public.is_lesson_open(lesson_id)
    AND EXISTS (
      SELECT 1 FROM public.lessons l
      WHERE l.id = submissions.lesson_id AND public.is_class_student(l.class_id)
    )
  );

DROP POLICY IF EXISTS "submissions_update_policy" ON public.submissions;
CREATE POLICY "submissions_update_policy"
  ON public.submissions
  FOR UPDATE
  TO authenticated
  USING (
    student_id = auth.uid()
    AND public.is_lesson_open(lesson_id)
    AND EXISTS (
      SELECT 1 FROM public.lessons l
      WHERE l.id = submissions.lesson_id AND public.is_class_student(l.class_id)
    )
  )
  WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "submissions_delete_policy" ON public.submissions;
CREATE POLICY "submissions_delete_policy"
  ON public.submissions
  FOR DELETE
  TO authenticated
  USING (
    student_id = auth.uid()
    AND public.is_lesson_open(lesson_id)
  );

-- 제출물을 다른 수업이나 다른 학생으로 옮기지 못하게 함
CREATE OR REPLACE FUNCTION public.prevent_submission_identity_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lesson_id IS DISTINCT FROM OLD.lesson_id
    OR NEW.student_id IS DISTINCT FROM OLD.student_id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION '제출물의 수업, 작성자, 작성 시각은 변경할 수 없습니다.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_prevent_submission_identity_change ON public.submissions;
CREATE TRIGGER trg_prevent_submission_identity_change
  BEFORE UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_submission_identity_change();

-- 3. 학생 화면용 익명 조회
-- 동료의 student_id, author_id는 내보내지 않고, 퀴즈 정답은 본인이 풀어 본 뒤에만 내보냄
CREATE OR REPLACE FUNCTION public.get_lesson_board(p_lesson_id UUID)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_class_id UUID;
  v_owner_id UUID;
  v_is_teacher BOOLEAN;
  v_submissions JSONB;
  v_groups JSONB;
BEGIN
  SELECT l.class_id, c.teacher_id INTO v_class_id, v_owner_id
  FROM public.lessons l
  JOIN public.classes c ON c.id = l.class_id
  WHERE l.id = p_lesson_id;

  IF v_user_id IS NULL OR v_class_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_is_teacher := public.is_class_teacher(v_class_id);
  IF NOT v_is_teacher AND NOT public.is_class_student(v_class_id) THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'lesson_id', s.lesson_id,
        'student_id', CASE WHEN s.student_id = v_user_id THEN v_user_id::text ELSE 'anonymous' END,
        'type', s.type,
        'content', s.content,
        'created_at', s.created_at,
        'updated_at', s.updated_at
      )
      ORDER BY s.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_submissions
  FROM public.submissions s
  WHERE s.lesson_id = p_lesson_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', g.id,
        'lesson_id', g.lesson_id,
        'representative_title', g.representative_title,
        'representative_content', CASE
          WHEN public.is_quiz_group_title(g.representative_title)
            AND NOT v_is_teacher
            AND NOT EXISTS (
              SELECT 1 FROM public.answers mine
              WHERE mine.group_id = g.id AND mine.author_id = v_user_id
            )
          THEN (
            COALESCE(public.safe_jsonb(g.representative_content), '{}'::jsonb)
            - ARRAY['correct_option_index', 'answer_text', 'explanation', 'rationale']
          )::text
          ELSE g.representative_content
        END,
        'is_published', g.is_published,
        'is_resolved', g.is_resolved,
        'created_at', g.created_at,
        'members', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', m.id,
              'submission', jsonb_build_object(
                'id', s.id,
                'lesson_id', s.lesson_id,
                'student_id', 'anonymous',
                'type', s.type,
                'content', s.content,
                'created_at', s.created_at
              )
            )
          )
          FROM public.question_group_members m
          JOIN public.submissions s ON s.id = m.submission_id
          WHERE m.group_id = g.id
        ), '[]'::jsonb),
        'answers', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', a.id,
              'group_id', a.group_id,
              'author_id', CASE
                WHEN a.author_id = v_user_id THEN v_user_id::text
                WHEN a.author_id = v_owner_id
                  OR EXISTS (
                    SELECT 1 FROM public.class_teachers ct
                    WHERE ct.class_id = v_class_id AND ct.teacher_id = a.author_id
                  )
                THEN 'teacher'
                ELSE 'anonymous'
              END,
              'content', a.content,
              'is_teacher_checked', a.is_teacher_checked,
              'created_at', a.created_at
            )
            ORDER BY a.created_at
          )
          FROM public.answers a
          WHERE a.group_id = g.id
            AND (
              NOT public.is_quiz_group_title(g.representative_title)
              OR a.author_id = v_user_id
            )
        ), '[]'::jsonb)
      )
      ORDER BY g.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_groups
  FROM public.question_groups g
  WHERE g.lesson_id = p_lesson_id;

  RETURN json_build_object('submissions', v_submissions, 'groups', v_groups);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

REVOKE ALL ON FUNCTION public.get_lesson_board(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_lesson_board(UUID) TO authenticated;

-- 4. 퀴즈 서버 채점
-- 정답 판정과 기록을 DB에서 처리해 클라이언트가 결과를 위조하지 못하게 함
CREATE OR REPLACE FUNCTION public.submit_quiz_attempt(
  p_group_id UUID,
  p_selected_option_index INT DEFAULT NULL,
  p_submitted_text TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_title TEXT;
  v_content TEXT;
  v_class_id UUID;
  v_key JSONB;
  v_text TEXT := NULLIF(btrim(COALESCE(p_submitted_text, '')), '');
  v_is_correct BOOLEAN := false;
  v_payload JSONB;
  v_answer_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', '로그인이 필요합니다.');
  END IF;

  SELECT g.representative_title, g.representative_content, l.class_id
  INTO v_title, v_content, v_class_id
  FROM public.question_groups g
  JOIN public.lessons l ON l.id = g.lesson_id
  WHERE g.id = p_group_id;

  IF v_title IS NULL OR NOT public.is_quiz_group_title(v_title) THEN
    RETURN json_build_object('success', false, 'message', '유효하지 않은 퀴즈 문항입니다.');
  END IF;

  IF NOT public.is_class_teacher(v_class_id) AND NOT public.is_class_student(v_class_id) THEN
    RETURN json_build_object('success', false, 'message', '소속된 클래스의 퀴즈만 응시할 수 있습니다.');
  END IF;

  IF length(COALESCE(v_text, '')) > 2000 THEN
    RETURN json_build_object('success', false, 'message', '답안이 너무 깁니다.');
  END IF;

  v_key := public.safe_jsonb(v_content);
  IF v_key IS NULL THEN
    RETURN json_build_object('success', false, 'message', '문항 정보를 확인할 수 없습니다.');
  END IF;

  IF v_key->>'question_type' = 'short_answer' THEN
    v_is_correct := v_text IS NOT NULL AND EXISTS (
      SELECT 1
      FROM unnest(string_to_array(COALESCE(v_key->>'answer_text', ''), ',')) AS candidate
      WHERE lower(regexp_replace(candidate, '\s+', '', 'g')) <> ''
        AND lower(regexp_replace(candidate, '\s+', '', 'g'))
          = lower(regexp_replace(v_text, '\s+', '', 'g'))
    );
  ELSE
    v_is_correct := p_selected_option_index IS NOT NULL
      AND (v_key->>'correct_option_index') ~ '^[0-9]+$'
      AND p_selected_option_index = (v_key->>'correct_option_index')::int;
  END IF;

  v_payload := jsonb_build_object(
    '__type', 'QUIZ_ATTEMPT',
    'selected_option_index', COALESCE(p_selected_option_index, -1),
    'is_correct', v_is_correct
  );
  IF v_text IS NOT NULL THEN
    v_payload := v_payload || jsonb_build_object('submitted_text', v_text);
  END IF;

  SELECT id INTO v_answer_id
  FROM public.answers
  WHERE group_id = p_group_id AND author_id = v_user_id
  ORDER BY created_at
  LIMIT 1
  FOR UPDATE;

  IF v_answer_id IS NULL THEN
    INSERT INTO public.answers (group_id, author_id, content, is_teacher_checked)
    VALUES (p_group_id, v_user_id, v_payload::text, v_is_correct);
  ELSE
    UPDATE public.answers
    SET content = v_payload::text, is_teacher_checked = v_is_correct
    WHERE id = v_answer_id;
  END IF;

  RETURN json_build_object('success', true, 'is_correct', v_is_correct);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.submit_inline_quiz_attempt(
  p_lesson_id UUID,
  p_quiz_block_id TEXT,
  p_selected_option_index INT DEFAULT NULL,
  p_submitted_text TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_group_id UUID;
BEGIN
  SELECT id INTO v_group_id
  FROM public.question_groups
  WHERE lesson_id = p_lesson_id
    AND starts_with(representative_title, '[__INLINE_QUIZ__]')
    AND public.safe_jsonb(representative_content)->>'inline_block_id' = p_quiz_block_id
  ORDER BY created_at
  LIMIT 1;

  IF v_group_id IS NULL THEN
    RETURN json_build_object('success', false, 'not_found', true);
  END IF;

  RETURN public.submit_quiz_attempt(v_group_id, p_selected_option_index, p_submitted_text);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.submit_quiz_attempt(UUID, INT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_inline_quiz_attempt(UUID, TEXT, INT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_quiz_attempt(UUID, INT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_inline_quiz_attempt(UUID, TEXT, INT, TEXT) TO authenticated;

COMMIT;
