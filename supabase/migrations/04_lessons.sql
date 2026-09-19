-- ==============================================================================
-- 04_lessons.sql
-- 3단계: 수업 레슨(lessons) 테이블, RLS 정책 및 인터랙티브 교안(material_html) 슬롯
-- ==============================================================================

-- 1. lessons 테이블 생성
CREATE TABLE IF NOT EXISTS public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  learning_objective TEXT NOT NULL,
  deadline TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  material_html TEXT, -- 인터랙티브 웹 교안 슬롯 (HTML/CSS/JS)
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_lessons_class_id ON public.lessons(class_id);
CREATE INDEX IF NOT EXISTS idx_lessons_created_at ON public.lessons(created_at);

-- 2. RLS 활성화
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

-- 3. 기존 lessons 관련 정책 정리
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
      SELECT policyname, tablename 
      FROM pg_policies 
      WHERE schemaname = 'public' AND tablename = 'lessons'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- 4. lessons RLS 정책 (순환 참조 없이 단방향 검사)
-- (1) 조회: 해당 클래스의 교사이거나, 해당 클래스에 속한 학생인 경우
CREATE POLICY "lessons_select_policy"
  ON public.lessons
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = lessons.class_id AND c.teacher_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.class_members cm
      WHERE cm.class_id = lessons.class_id AND cm.student_id = auth.uid()
    )
  );

-- (2) 생성: 해당 클래스를 개설한 교사만 레슨 생성 가능
CREATE POLICY "lessons_insert_policy"
  ON public.lessons
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = lessons.class_id AND c.teacher_id = auth.uid()
    )
  );

-- (3) 수정: 해당 클래스를 개설한 교사만 레슨 수정 가능 (상태 open/closed 토글 등)
CREATE POLICY "lessons_update_policy"
  ON public.lessons
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = lessons.class_id AND c.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = lessons.class_id AND c.teacher_id = auth.uid()
    )
  );

-- (4) 삭제: 해당 클래스를 개설한 교사만 레슨 삭제 가능
CREATE POLICY "lessons_delete_policy"
  ON public.lessons
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = lessons.class_id AND c.teacher_id = auth.uid()
    )
  );

