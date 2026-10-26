-- ==============================================================================
-- 06_groups_and_answers.sql
-- 6~7단계: 대표 질문 그룹핑(question_groups, question_group_members) 및 동료 답변(answers)
-- ==============================================================================

-- 1. question_groups 테이블 생성
CREATE TABLE IF NOT EXISTS public.question_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  representative_title TEXT NOT NULL,
  representative_content TEXT NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT true,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_question_groups_lesson_id ON public.question_groups(lesson_id);

-- 2. question_group_members 테이블 생성 (순수 연관 매핑: 원본 학생 질문 불변 보존)
CREATE TABLE IF NOT EXISTS public.question_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.question_groups(id) ON DELETE CASCADE,
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(group_id, submission_id)
);

CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON public.question_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_submission_id ON public.question_group_members(submission_id);

-- 3. answers 테이블 생성 (동료 답변 및 교사 검증 도장)
CREATE TABLE IF NOT EXISTS public.answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.question_groups(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_teacher_checked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_answers_group_id ON public.answers(group_id);
CREATE INDEX IF NOT EXISTS idx_answers_author_id ON public.answers(author_id);

-- 4. RLS 활성화
ALTER TABLE public.question_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;

-- 5. 기존 정책 정리
DROP POLICY IF EXISTS "groups_select_policy" ON public.question_groups;
DROP POLICY IF EXISTS "groups_insert_policy" ON public.question_groups;
DROP POLICY IF EXISTS "groups_update_policy" ON public.question_groups;
DROP POLICY IF EXISTS "groups_delete_policy" ON public.question_groups;

DROP POLICY IF EXISTS "group_members_select_policy" ON public.question_group_members;
DROP POLICY IF EXISTS "group_members_insert_policy" ON public.question_group_members;
DROP POLICY IF EXISTS "group_members_delete_policy" ON public.question_group_members;

DROP POLICY IF EXISTS "answers_select_policy" ON public.answers;
DROP POLICY IF EXISTS "answers_insert_policy" ON public.answers;
DROP POLICY IF EXISTS "answers_update_policy" ON public.answers;
DROP POLICY IF EXISTS "answers_delete_policy" ON public.answers;

-- 6. question_groups RLS 정책
-- (1) 조회: 같은 반 교사 또는 학생
CREATE POLICY "groups_select_policy"
  ON public.question_groups
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.lessons l
      JOIN public.classes c ON c.id = l.class_id
      WHERE l.id = question_groups.lesson_id AND (
        c.teacher_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.class_members cm
          WHERE cm.class_id = c.id AND cm.student_id = auth.uid()
        )
      )
    )
  );

-- (2) 생성/수정/삭제: 해당 학급의 교사만 가능
CREATE POLICY "groups_insert_policy"
  ON public.question_groups
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lessons l
      JOIN public.classes c ON c.id = l.class_id
      WHERE l.id = question_groups.lesson_id AND c.teacher_id = auth.uid()
    )
  );

CREATE POLICY "groups_update_policy"
  ON public.question_groups
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.lessons l
      JOIN public.classes c ON c.id = l.class_id
      WHERE l.id = question_groups.lesson_id AND c.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lessons l
      JOIN public.classes c ON c.id = l.class_id
      WHERE l.id = question_groups.lesson_id AND c.teacher_id = auth.uid()
    )
  );

CREATE POLICY "groups_delete_policy"
  ON public.question_groups
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.lessons l
      JOIN public.classes c ON c.id = l.class_id
      WHERE l.id = question_groups.lesson_id AND c.teacher_id = auth.uid()
    )
  );

-- 7. question_group_members RLS 정책 (소속 학급 구성원만 조회, 교사만 묶기/해제 가능)
CREATE POLICY "group_members_select_policy"
  ON public.question_group_members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.question_groups qg
      JOIN public.lessons l ON l.id = qg.lesson_id
      JOIN public.classes c ON c.id = l.class_id
      WHERE qg.id = question_group_members.group_id AND (
        c.teacher_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.class_members cm
          WHERE cm.class_id = c.id AND cm.student_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "group_members_insert_policy"
  ON public.question_group_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.question_groups qg
      JOIN public.lessons l ON l.id = qg.lesson_id
      JOIN public.classes c ON c.id = l.class_id
      WHERE qg.id = question_group_members.group_id AND c.teacher_id = auth.uid()
    )
  );

CREATE POLICY "group_members_delete_policy"
  ON public.question_group_members
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.question_groups qg
      JOIN public.lessons l ON l.id = qg.lesson_id
      JOIN public.classes c ON c.id = l.class_id
      WHERE qg.id = question_group_members.group_id AND c.teacher_id = auth.uid()
    )
  );

-- 8. answers RLS 정책
-- (1) 조회: 같은 반 구성원만 조회 가능하며, 형성평가([__QUIZ__]) 답안은 본인과 담당 교사만 조회 가능
CREATE POLICY "answers_select_policy"
  ON public.answers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.question_groups qg
      JOIN public.lessons l ON l.id = qg.lesson_id
      JOIN public.classes c ON c.id = l.class_id
      WHERE qg.id = answers.group_id
        AND (
          c.teacher_id = auth.uid()
          OR (
            EXISTS (
              SELECT 1 FROM public.class_members cm
              WHERE cm.class_id = c.id AND cm.student_id = auth.uid()
            )
            AND (
              qg.representative_title NOT LIKE '[__QUIZ__]%'
              OR answers.author_id = auth.uid()
            )
          )
        )
    )
  );

-- (2) 생성: 해당 학급 소속 학생 또는 담당 교사 본인만 작성
CREATE POLICY "answers_insert_policy"
  ON public.answers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.question_groups qg
      JOIN public.lessons l ON l.id = qg.lesson_id
      JOIN public.classes c ON c.id = l.class_id
      WHERE qg.id = answers.group_id AND (
        c.teacher_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.class_members cm
          WHERE cm.class_id = c.id AND cm.student_id = auth.uid()
        )
      )
    )
  );

-- (3) 수정: 담당 교사(검증 도장 토글) 또는 작성자 본인(퀴즈 재응시 등)만 가능
CREATE POLICY "answers_update_policy"
  ON public.answers
  FOR UPDATE
  TO authenticated
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.question_groups qg
      JOIN public.lessons l ON l.id = qg.lesson_id
      JOIN public.classes c ON c.id = l.class_id
      WHERE qg.id = answers.group_id AND c.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.question_groups qg
      JOIN public.lessons l ON l.id = qg.lesson_id
      JOIN public.classes c ON c.id = l.class_id
      WHERE qg.id = answers.group_id AND c.teacher_id = auth.uid()
    )
  );

-- (4) 삭제: 본인 작성자 또는 담당 교사만 삭제
CREATE POLICY "answers_delete_policy"
  ON public.answers
  FOR DELETE
  TO authenticated
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.question_groups qg
      JOIN public.lessons l ON l.id = qg.lesson_id
      JOIN public.classes c ON c.id = l.class_id
      WHERE qg.id = answers.group_id AND c.teacher_id = auth.uid()
    )
  );

