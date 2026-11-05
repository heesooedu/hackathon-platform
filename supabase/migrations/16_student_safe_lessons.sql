-- ==============================================================================
-- 16_student_safe_lessons.sql
-- 학생에게 교안을 보낼 때 인라인 퀴즈 정답과 교사용 AI 리포트를 제거하는 RPC 추가
--
-- 이 파일은 기존 앱과 함께 동작합니다. 학생의 lessons 직접 조회 차단은
-- 새 앱이 배포된 뒤 17_restrict_lesson_reads.sql에서 진행합니다.
-- ==============================================================================

BEGIN;

-- 1. 교안 마크다운의 ```quiz 블록을 찾아 정답을 지운 본문과 원본 블록 목록을 돌려줌
-- 펜스 규칙은 frontend/src/utils/notionBlocks.ts의 markdownToBlocks와 맞춤
CREATE OR REPLACE FUNCTION public.scan_quiz_blocks(
  p_markdown TEXT,
  OUT sanitized TEXT,
  OUT blocks JSONB
) AS $$
DECLARE
  v_line TEXT;
  v_trimmed TEXT;
  v_header TEXT;
  v_state TEXT := NULL;
  v_buffer TEXT := '';
  v_block JSONB;
  v_out TEXT[] := ARRAY[]::TEXT[];
BEGIN
  blocks := '[]'::jsonb;

  IF p_markdown IS NULL OR position('```' IN p_markdown) = 0 THEN
    sanitized := p_markdown;
    RETURN;
  END IF;

  FOREACH v_line IN ARRAY string_to_array(replace(p_markdown, E'\r', ''), E'\n') LOOP
    v_trimmed := btrim(v_line);

    IF v_state IS NULL THEN
      IF starts_with(v_trimmed, '```') THEN
        v_header := lower(btrim(substr(v_trimmed, 4)));
        v_state := CASE
          WHEN v_header = 'quiz' OR starts_with(v_header, 'quiz:') THEN 'quiz'
          ELSE 'other'
        END;
        v_buffer := '';
      END IF;
      v_out := array_append(v_out, v_line);
    ELSIF starts_with(v_trimmed, '```') THEN
      IF v_state = 'quiz' THEN
        v_block := public.safe_jsonb(v_buffer);
        IF jsonb_typeof(v_block) = 'object' THEN
          blocks := blocks || jsonb_build_array(v_block);
          v_out := array_append(v_out, (
            v_block - ARRAY['correctOptionIndex', 'correct_option_index', 'answerText', 'answer_text', 'explanation']
          )::text);
        ELSE
          v_out := array_append(v_out, '{}');
        END IF;
      END IF;
      v_state := NULL;
      v_out := array_append(v_out, v_line);
    ELSIF v_state = 'quiz' THEN
      v_buffer := v_buffer || v_line || E'\n';
    ELSE
      v_out := array_append(v_out, v_line);
    END IF;
  END LOOP;

  -- 닫는 펜스가 없는 quiz 블록의 내용은 내보내지 않음
  sanitized := array_to_string(v_out, E'\n');
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.strip_patch_quiz_answers(p_patches JSONB)
RETURNS JSONB AS $$
  SELECT COALESCE(
    jsonb_agg(
      CASE
        WHEN jsonb_typeof(patch) = 'object' AND patch ? 'content_markdown'
        THEN jsonb_set(
          patch,
          '{content_markdown}',
          to_jsonb((public.scan_quiz_blocks(patch->>'content_markdown')).sanitized)
        )
        ELSE patch
      END
    ),
    '[]'::jsonb
  )
  FROM jsonb_array_elements(p_patches) AS patch;
$$ LANGUAGE sql IMMUTABLE SET search_path = public;

-- 2. material_html의 메타 봉투를 풀어 학생용 값으로 다시 만듦
-- 해석할 수 없는 봉투는 정답이 새지 않도록 내보내지 않음
CREATE OR REPLACE FUNCTION public.decode_material_envelope(p_raw TEXT)
RETURNS JSONB AS $$
DECLARE
  v_prefix CONSTANT TEXT := '<!--__PEDAGOGY_V2_META__:';
  v_suffix CONSTANT TEXT := ':__END_PEDAGOGY_V2_META__-->';
  v_start INT := position(v_prefix IN COALESCE(p_raw, ''));
  v_end INT := position(v_suffix IN COALESCE(p_raw, ''));
BEGIN
  IF v_start = 0 OR v_end <= v_start THEN
    RETURN NULL;
  END IF;

  RETURN convert_from(
    decode(substr(p_raw, v_start + length(v_prefix), v_end - v_start - length(v_prefix)), 'base64'),
    'UTF8'
  )::jsonb;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.student_safe_material(p_raw TEXT)
RETURNS TEXT AS $$
DECLARE
  v_prefix CONSTANT TEXT := '<!--__PEDAGOGY_V2_META__:';
  v_suffix CONSTANT TEXT := ':__END_PEDAGOGY_V2_META__-->';
  v_start INT := position(v_prefix IN COALESCE(p_raw, ''));
  v_end INT := position(v_suffix IN COALESCE(p_raw, ''));
  v_envelope JSONB;
BEGIN
  IF v_start = 0 OR v_end <= v_start THEN
    RETURN (public.scan_quiz_blocks(p_raw)).sanitized;
  END IF;

  v_envelope := public.decode_material_envelope(p_raw);
  IF v_envelope IS NULL THEN
    RETURN NULL;
  END IF;

  v_envelope := (v_envelope - ARRAY['aiAnalysis', 'sourceMaterialId'])
    || jsonb_build_object(
      'markdownContent', (public.scan_quiz_blocks(v_envelope->>'markdownContent')).sanitized,
      'appliedPatches', CASE
        WHEN jsonb_typeof(v_envelope->'appliedPatches') = 'array'
        THEN public.strip_patch_quiz_answers(v_envelope->'appliedPatches')
        ELSE '[]'::jsonb
      END
    );

  RETURN left(p_raw, v_start - 1)
    || v_prefix
    || replace(encode(convert_to(v_envelope::text, 'UTF8'), 'base64'), E'\n', '')
    || v_suffix
    || substr(p_raw, v_end + length(v_suffix));
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.student_safe_lesson(p_lesson public.lessons)
RETURNS JSONB AS $$
DECLARE
  v_patches JSONB := public.safe_jsonb(p_lesson.ai_supplement_markdown);
BEGIN
  RETURN to_jsonb(p_lesson) || jsonb_build_object(
    'material_html', public.student_safe_material(p_lesson.material_html),
    'material_markdown', (public.scan_quiz_blocks(p_lesson.material_markdown)).sanitized,
    'ai_supplement_markdown', CASE
      WHEN jsonb_typeof(v_patches) = 'array' THEN public.strip_patch_quiz_answers(v_patches)::text
      ELSE (public.scan_quiz_blocks(p_lesson.ai_supplement_markdown)).sanitized
    END,
    'ai_review_json', NULL
  );
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public;

REVOKE ALL ON FUNCTION public.scan_quiz_blocks(TEXT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.strip_patch_quiz_answers(JSONB) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.decode_material_envelope(TEXT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.student_safe_material(TEXT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.student_safe_lesson(public.lessons) FROM PUBLIC, anon, authenticated, service_role;

-- 3. 학생 화면용 수업 조회
CREATE OR REPLACE FUNCTION public.get_student_lesson(p_lesson_id UUID)
RETURNS JSON AS $$
DECLARE
  v_lesson public.lessons;
BEGIN
  SELECT * INTO v_lesson FROM public.lessons WHERE id = p_lesson_id;

  IF v_lesson.id IS NULL
    OR NOT (public.is_class_student(v_lesson.class_id) OR public.is_class_teacher(v_lesson.class_id)) THEN
    RETURN NULL;
  END IF;

  RETURN public.student_safe_lesson(v_lesson);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_student_lessons(p_class_id UUID)
RETURNS JSON AS $$
BEGIN
  IF NOT (public.is_class_student(p_class_id) OR public.is_class_teacher(p_class_id)) THEN
    RETURN '[]'::json;
  END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(public.student_safe_lesson(l) ORDER BY l.created_at DESC)
      FROM public.lessons l
      WHERE l.class_id = p_class_id
    ),
    '[]'::jsonb
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

REVOKE ALL ON FUNCTION public.get_student_lesson(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_student_lessons(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_student_lesson(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_lessons(UUID) TO authenticated;

-- 4. 정책에서 쓰는 보조 함수 (학생이 lessons를 직접 읽지 못해도 소속을 판단)
CREATE OR REPLACE FUNCTION public.is_lesson_student(p_lesson_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.lessons l
    JOIN public.class_members cm ON cm.class_id = l.class_id
    WHERE l.id = p_lesson_id AND cm.student_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_lesson_teacher(p_lesson_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.lessons l
    WHERE l.id = p_lesson_id AND public.is_class_teacher(l.class_id)
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

REVOKE ALL ON FUNCTION public.is_lesson_student(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_lesson_teacher(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_lesson_student(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_lesson_teacher(UUID) TO authenticated;

-- 5. 채점용 그룹이 없는 예전 교안의 인라인 퀴즈를 보충
-- 학생은 교안 원문을 읽지 못하게 되므로 정답 키는 question_groups에 있어야 함
DO $$
DECLARE
  v_lesson RECORD;
  v_markdown TEXT;
  v_block JSONB;
  v_index INT;
BEGIN
  FOR v_lesson IN
    SELECT l.id, l.material_html, l.material_markdown
    FROM public.lessons l
    JOIN public.classes c ON c.id = l.class_id
    WHERE c.join_code NOT LIKE '#%'
  LOOP
    v_markdown := COALESCE(
      NULLIF(public.decode_material_envelope(v_lesson.material_html)->>'markdownContent', ''),
      v_lesson.material_markdown,
      v_lesson.material_html
    );
    v_index := 0;

    FOR v_block IN
      SELECT value FROM jsonb_array_elements((public.scan_quiz_blocks(v_markdown)).blocks)
    LOOP
      v_index := v_index + 1;

      IF COALESCE(v_block->>'quizId', '') <> '' AND NOT EXISTS (
        SELECT 1 FROM public.question_groups g
        WHERE g.lesson_id = v_lesson.id
          AND starts_with(g.representative_title, '[__INLINE_QUIZ__]')
          AND public.safe_jsonb(g.representative_content)->>'inline_block_id' = v_block->>'quizId'
      ) THEN
        INSERT INTO public.question_groups (
          lesson_id, representative_title, representative_content, is_published, is_resolved
        )
        VALUES (
          v_lesson.id,
          '[__INLINE_QUIZ__]체크포인트 Q' || v_index || '. ' || COALESCE(v_block->>'questionText', ''),
          jsonb_build_object(
            'inline_block_id', v_block->>'quizId',
            'question_type', COALESCE(v_block->>'questionType', 'multiple_choice'),
            'question_text', v_block->>'questionText',
            'options', COALESCE(v_block->'options', '[]'::jsonb),
            'correct_option_index', COALESCE((v_block->>'correctOptionIndex')::int, 0),
            'answer_text', COALESCE(v_block->>'answerText', ''),
            'explanation', COALESCE(v_block->>'explanation', ''),
            'target_concept', COALESCE(v_block->>'targetConcept', '핵심 개념 확인')
          )::text,
          true,
          false
        );
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

COMMIT;
