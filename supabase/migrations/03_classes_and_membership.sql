-- ==============================================================================
-- 03_classes_and_membership.sql (순환 참조 100% 해결 버전)
-- 기존의 모든 잔여 정책을 일괄 정리하고 단방향 정책으로 재귀를 원천 차단합니다.
-- ==============================================================================

-- 1. 기존의 classes 및 class_members에 걸려있던 모든 구버전 정책 일괄 삭제
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
      SELECT policyname, tablename 
      FROM pg_policies 
      WHERE schemaname = 'public' AND tablename IN ('classes', 'class_members')
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- 2. classes 테이블 생성 (기존에 있으면 유지)
CREATE TABLE IF NOT EXISTS public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  join_code VARCHAR(6) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_classes_teacher_id ON public.classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_classes_join_code ON public.classes(join_code);

-- 3. class_members 테이블 생성
CREATE TABLE IF NOT EXISTS public.class_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(class_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_class_members_class_id ON public.class_members(class_id);
CREATE INDEX IF NOT EXISTS idx_class_members_student_id ON public.class_members(student_id);

-- 4. RLS 활성화
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_members ENABLE ROW LEVEL SECURITY;

-- 5. classes RLS 정책
-- (1) 조회: 내가 교사이거나, 내가 class_members에 속한 학생인 경우
CREATE POLICY "classes_select_policy"
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

-- (2) 생성: 교사 본인의 클래스만 생성
CREATE POLICY "classes_insert_policy"
  ON public.classes
  FOR INSERT
  TO authenticated
  WITH CHECK (teacher_id = auth.uid());

-- (3) 수정: 교사 본인의 클래스만 수정
CREATE POLICY "classes_update_policy"
  ON public.classes
  FOR UPDATE
  TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

-- (4) 삭제: 교사 본인의 클래스만 삭제
CREATE POLICY "classes_delete_policy"
  ON public.classes
  FOR DELETE
  TO authenticated
  USING (teacher_id = auth.uid());

-- 6. class_members RLS 정책
-- ★ 중요: class_members에서는 classes 테이블을 다시 조회하지 않으므로 순환 참조가 100% 원천 차단됩니다.
CREATE POLICY "class_members_select_policy"
  ON public.class_members
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "class_members_delete_policy"
  ON public.class_members
  FOR DELETE
  TO authenticated
  USING (student_id = auth.uid());

-- 7. 학생 6자리 코드 참여 RPC 함수 (SECURITY DEFINER로 안전하게 실행)
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
