-- ==============================================================================
-- 07_material_refinement_and_quizzes.sql
-- 8단계: 범용 교안(마크다운/문서 파일), 원클릭 교안 패치, 오개념 타겟팅 형성평가 및 학생 풀이
-- ==============================================================================

-- 1. lessons 테이블에 범용 교안 및 AI 패치/진단 컬럼 추가
ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS material_type TEXT NOT NULL DEFAULT 'markdown' CHECK (material_type IN ('markdown', 'html')),
  ADD COLUMN IF NOT EXISTS material_markdown TEXT,
  ADD COLUMN IF NOT EXISTS material_file_name TEXT,
  ADD COLUMN IF NOT EXISTS ai_supplement_markdown TEXT,
  ADD COLUMN IF NOT EXISTS ai_review_json JSONB;

-- 2. formative_quizzes 테이블 생성 (학생 질문/오개념 기반 맞춤형 형성평가 문항)
CREATE TABLE IF NOT EXISTS public.formative_quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_option_index INTEGER NOT NULL DEFAULT 0,
  explanation TEXT NOT NULL,
  rationale TEXT NOT NULL,
  target_concept TEXT,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_formative_quizzes_lesson_id ON public.formative_quizzes(lesson_id);

-- 3. quiz_attempts 테이블 생성 (학생들의 형성평가 풀이 및 오개념 해소 검증)
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.formative_quizzes(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  selected_option_index INTEGER NOT NULL,
  is_correct BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(quiz_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_lesson_id ON public.quiz_attempts(lesson_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_id ON public.quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_student_id ON public.quiz_attempts(student_id);

-- 4. RLS 활성화
ALTER TABLE public.formative_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

-- 5. 기존 정책 정리
DROP POLICY IF EXISTS "quizzes_select_policy" ON public.formative_quizzes;
DROP POLICY IF EXISTS "quizzes_insert_policy" ON public.formative_quizzes;
DROP POLICY IF EXISTS "quizzes_update_policy" ON public.formative_quizzes;
DROP POLICY IF EXISTS "quizzes_delete_policy" ON public.formative_quizzes;

DROP POLICY IF EXISTS "attempts_select_policy" ON public.quiz_attempts;
DROP POLICY IF EXISTS "attempts_insert_policy" ON public.quiz_attempts;
DROP POLICY IF EXISTS "attempts_update_policy" ON public.quiz_attempts;

-- 6. formative_quizzes RLS 정책
-- (1) 조회: 해당 클래스의 교사이거나 소속 학생
CREATE POLICY "quizzes_select_policy"
  ON public.formative_quizzes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.lessons l
      JOIN public.classes c ON c.id = l.class_id
      WHERE l.id = formative_quizzes.lesson_id AND (
        c.teacher_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.class_members cm
          WHERE cm.class_id = c.id AND cm.student_id = auth.uid()
        )
      )
    )
  );

-- (2) 생성/수정/삭제: 해당 클래스의 교사만 가능
CREATE POLICY "quizzes_insert_policy"
  ON public.formative_quizzes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lessons l
      JOIN public.classes c ON c.id = l.class_id
      WHERE l.id = formative_quizzes.lesson_id AND c.teacher_id = auth.uid()
    )
  );

CREATE POLICY "quizzes_update_policy"
  ON public.formative_quizzes
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.lessons l
      JOIN public.classes c ON c.id = l.class_id
      WHERE l.id = formative_quizzes.lesson_id AND c.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lessons l
      JOIN public.classes c ON c.id = l.class_id
      WHERE l.id = formative_quizzes.lesson_id AND c.teacher_id = auth.uid()
    )
  );

CREATE POLICY "quizzes_delete_policy"
  ON public.formative_quizzes
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.lessons l
      JOIN public.classes c ON c.id = l.class_id
      WHERE l.id = formative_quizzes.lesson_id AND c.teacher_id = auth.uid()
    )
  );

-- 7. quiz_attempts RLS 정책
-- (1) 조회: 본인 응시 내역이거나 해당 수업의 교사
CREATE POLICY "attempts_select_policy"
  ON public.quiz_attempts
  FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.lessons l
      JOIN public.classes c ON c.id = l.class_id
      WHERE l.id = quiz_attempts.lesson_id AND c.teacher_id = auth.uid()
    )
  );

-- (2) 생성/수정: 학생 본인만 등록 및 재응시 가능
CREATE POLICY "attempts_insert_policy"
  ON public.quiz_attempts
  FOR INSERT
  TO authenticated
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "attempts_update_policy"
  ON public.quiz_attempts
  FOR UPDATE
  TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());
