-- ==============================================================================
-- 05_submissions.sql
-- 4~5단계: 학생 질문 제출 및 질문 보드(submissions) 테이블 및 RLS 정책
-- ==============================================================================

-- 1. submissions 테이블 생성
CREATE TABLE IF NOT EXISTS public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('question', 'confusion', 'understood', 'explore')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(lesson_id, student_id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_submissions_lesson_id ON public.submissions(lesson_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON public.submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_submissions_type ON public.submissions(type);

-- 2. RLS 활성화
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- 3. 기존 submissions 관련 정책 정리
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
      SELECT policyname, tablename 
      FROM pg_policies 
      WHERE schemaname = 'public' AND tablename IN ('submissions')
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- 4. submissions RLS 정책 (5단계 질문 보드 조회를 위한 확장)

-- (1) 조회:
-- - 학생 본인
-- - 또는 해당 클래스를 개설한 교사
-- - 또는 해당 클래스에 속한 동료 학생 (질문 보드 렌더링 목적)
CREATE POLICY "submissions_select_policy"
  ON public.submissions
  FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 
      FROM public.lessons l
      JOIN public.classes c ON c.id = l.class_id
      WHERE l.id = submissions.lesson_id AND c.teacher_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 
      FROM public.lessons l
      JOIN public.class_members cm ON cm.class_id = l.class_id
      WHERE l.id = submissions.lesson_id AND cm.student_id = auth.uid()
    )
  );

-- (2) 생성: 학생 본인만 등록 가능하며, 해당 클래스 멤버여야 함
CREATE POLICY "submissions_insert_policy"
  ON public.submissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1 
      FROM public.lessons l
      JOIN public.class_members cm ON cm.class_id = l.class_id
      WHERE l.id = submissions.lesson_id AND cm.student_id = auth.uid()
    )
  );

-- (3) 수정: 학생 본인만 수정 가능
CREATE POLICY "submissions_update_policy"
  ON public.submissions
  FOR UPDATE
  TO authenticated
  USING (
    student_id = auth.uid()
  )
  WITH CHECK (
    student_id = auth.uid()
  );

-- (4) 삭제: 학생 본인만 삭제 가능
CREATE POLICY "submissions_delete_policy"
  ON public.submissions
  FOR DELETE
  TO authenticated
  USING (
    student_id = auth.uid()
  );
