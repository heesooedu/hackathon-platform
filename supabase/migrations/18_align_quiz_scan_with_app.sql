-- ==============================================================================
-- 18_align_quiz_scan_with_app.sql
-- 학생용 교안의 정답 제거가 앱의 교안 해석과 같은 기준으로 동작하도록 맞춤
--
-- 앱은 줄 앞뒤의 탭과 전각 공백까지 지우고 quiz 펜스를 찾지만, 16의 scan_quiz_blocks는
-- 일반 공백만 지워서 그런 퀴즈의 정답을 남겼습니다. 앱은 봉투를 맨 뒤에서 찾으므로
-- 봉투 위치 기준도 맞춥니다. 앱 배포와 순서는 상관없고, 다시 실행해도 안전합니다.
-- ==============================================================================

BEGIN;

-- 1. 자바스크립트 trim()이 지우는 문자와 같은 문자를 지움
CREATE OR REPLACE FUNCTION public.trim_like_app(p_value TEXT)
RETURNS TEXT AS $$
  SELECT btrim(
    p_value,
    E' \t\n\u000B\f\r\u00A0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF'
  );
$$ LANGUAGE sql IMMUTABLE SET search_path = public;

-- 2. 문자열에서 마지막으로 나타나는 위치 (없으면 0)
CREATE OR REPLACE FUNCTION public.last_position(p_text TEXT, p_needle TEXT)
RETURNS INT AS $$
  SELECT CASE
    WHEN position(reverse(p_needle) IN reverse(p_text)) = 0 THEN 0
    ELSE length(p_text) - position(reverse(p_needle) IN reverse(p_text)) - length(p_needle) + 2
  END;
$$ LANGUAGE sql IMMUTABLE SET search_path = public;

REVOKE ALL ON FUNCTION public.trim_like_app(TEXT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.last_position(TEXT, TEXT) FROM PUBLIC, anon, authenticated, service_role;

-- 3. quiz 블록 찾기
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

  FOREACH v_line IN ARRAY string_to_array(replace(replace(p_markdown, E'\r\n', E'\n'), E'\r', E'\n'), E'\n') LOOP
    v_trimmed := public.trim_like_app(v_line);

    IF v_state IS NULL THEN
      IF starts_with(v_trimmed, '```') THEN
        v_header := lower(public.trim_like_app(substr(v_trimmed, 4)));
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

-- 4. 메타 봉투 풀기
CREATE OR REPLACE FUNCTION public.decode_material_envelope(p_raw TEXT)
RETURNS JSONB AS $$
DECLARE
  v_prefix CONSTANT TEXT := '<!--__PEDAGOGY_V2_META__:';
  v_suffix CONSTANT TEXT := ':__END_PEDAGOGY_V2_META__-->';
  v_start INT := public.last_position(COALESCE(p_raw, ''), v_prefix);
  v_end INT := public.last_position(COALESCE(p_raw, ''), v_suffix);
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
  v_start INT := public.last_position(COALESCE(p_raw, ''), v_prefix);
  v_end INT := public.last_position(COALESCE(p_raw, ''), v_suffix);
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

COMMIT;
