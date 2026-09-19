-- ==============================================================================
-- 03_classes_and_membership.sql
-- 2단계: 클래스(classes) 및 멤버십(class_members) 테이블, RLS 및 참여 함수
-- ==============================================================================

-- 1. classes 테이블 생성
CREATE TABLE IF NOT EXISTS public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  join_code VARCHAR(6) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 인덱스 생성
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

-- 4. classes RLS 정책
-- (1) 교사는 자신이 만든 클래스를 조회할 수 있고, 학생은 자신이 속한 클래스를 조회할 수 있음
CREATE POLICY "Users can view classes they belong to"
  ON public.classes
  FOR SELECT
  TO authenticated
  USING (
    teacher_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.class_members cm
      WHERE cm.class_id = classes.id AND cm.student_id = auth.uid()
    )
  );

-- (2) 교사만 클래스를 생성할 수 있음
CREATE POLICY "Teachers can insert their own classes"
  ON public.classes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    teacher_id = auth.uid()
  );

-- (3) 교사만 자신이 만든 클래스를 수정/삭제할 수 있음
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

-- 5. class_members RLS 정책
-- (1) 해당 클래스의 교사이거나 본인인 경우 멤버십 목록 조회 가능
CREATE POLICY "Members can view class membership"
  ON public.class_members
  FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_members.class_id AND c.teacher_id = auth.uid()
    )
  );

-- 6. 학생의 6자리 참여 코드로 클래스 등록을 처리하는 안전한 RPC 함수
CREATE OR REPLACE FUNCTION public.join_class_by_code(p_join_code TEXT)
RETURNS JSON AS $$
DECLARE
  v_class_id UUID;
  v_class_name TEXT;
  v_teacher_id UUID;
  v_student_id UUID := auth.uid();
  v_existing_id UUID;
BEGIN
  -- 1. 코드 대문자 정규화
  p_join_code := UPPER(TRIM(p_join_code));

  -- 2. 해당 코드의 클래스 조회
  SELECT id, name, teacher_id
  INTO v_class_id, v_class_name, v_teacher_id
  FROM public.classes
  WHERE join_code = p_join_code;

  IF v_class_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', '유효하지 않은 참여 코드입니다. 다시 확인해 주세요.');
  END IF;

  -- 3. 교사 본인이 참여하려는 경우 방지
  IF v_teacher_id = v_student_id THEN
    RETURN json_build_object('success', false, 'message', '선생님 본인이 개설한 클래스에는 학생으로 참여할 수 없습니다.');
  END IF;

  -- 4. 이미 참여 중인지 확인
  SELECT id INTO v_existing_id
  FROM public.class_members
  WHERE class_id = v_class_id AND student_id = v_student_id;

  IF v_existing_id IS NOT NULL THEN
    RETURN json_build_object('success', true, 'class_id', v_class_id, 'class_name', v_class_name, 'already_joined', true, 'message', '이미 참여 중인 클래스입니다.');
  END IF;

  -- 5. 신규 참여 등록
  INSERT INTO public.class_members (class_id, student_id)
  VALUES (v_class_id, v_student_id);

  RETURN json_build_object('success', true, 'class_id', v_class_id, 'class_name', v_class_name, 'already_joined', false, 'message', '클래스에 성공적으로 참여했습니다.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
