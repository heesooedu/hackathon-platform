-- ==============================================================================
-- 03_classes_and_membership.sql (수정본)
-- RLS 상호 순환 참조(Infinite Recursion)를 방지하기 위해 
-- SECURITY DEFINER 헬퍼 함수를 적용한 버전입니다.
-- ==============================================================================

-- 1. classes 테이블 생성 (기존 테이블이 있으면 유지)
CREATE TABLE IF NOT EXISTS public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  join_code VARCHAR(6) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_classes_teacher_id ON public.classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_classes_join_code ON public.classes(join_code);

-- 2. class_members 테이블 생성
CREATE TABLE IF NOT EXISTS public.class_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(class_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_class_members_class_id ON public.class_members(class_id);
CREATE INDEX IF NOT EXISTS idx_class_members_student_id ON public.class_members(student_id);

-- 3. RLS 활성화
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_members ENABLE ROW LEVEL SECURITY;

-- 4. 무한 재귀 방지를 위한 SECURITY DEFINER 헬퍼 함수
-- (함수 내부에서는 RLS를 우회하여 순환 참조를 원천 차단합니다)
CREATE OR REPLACE FUNCTION public.check_is_class_teacher(c_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classes
    WHERE id = c_id AND teacher_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.check_is_class_member(c_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.class_members
    WHERE class_id = c_id AND student_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 5. 기존 정책 제거 후 재등록
DROP POLICY IF EXISTS "Users can view classes they belong to" ON public.classes;
DROP POLICY IF EXISTS "Teachers can insert their own classes" ON public.classes;
DROP POLICY IF EXISTS "Teachers can update their own classes" ON public.classes;
DROP POLICY IF EXISTS "Teachers can delete their own classes" ON public.classes;
DROP POLICY IF EXISTS "Members can view class membership" ON public.class_members;

-- 6. classes RLS 정책 (헬퍼 함수 사용으로 무한 재귀 해결)
CREATE POLICY "Users can view classes they belong to"
  ON public.classes
  FOR SELECT
  TO authenticated
  USING (
    teacher_id = auth.uid()
    OR public.check_is_class_member(id)
  );

CREATE POLICY "Teachers can insert their own classes"
  ON public.classes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    teacher_id = auth.uid()
  );

CREATE POLICY "Teachers can update their own classes"
  ON public.classes
  FOR UPDATE
  TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers can delete their own classes"
  ON public.classes
  FOR DELETE
  TO authenticated
  USING (teacher_id = auth.uid());

-- 7. class_members RLS 정책 (헬퍼 함수 사용으로 무한 재귀 해결)
CREATE POLICY "Members can view class membership"
  ON public.class_members
  FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid()
    OR public.check_is_class_teacher(class_id)
  );

-- 8. 학생 6자리 코드 참여 RPC 함수
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
