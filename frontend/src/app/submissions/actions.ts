'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { SubmissionType } from '@/types/database.types';

export async function submitLearningStatus(formData: FormData) {
  const lessonId = formData.get('lesson_id') as string;
  const classId = formData.get('class_id') as string;
  const type = formData.get('type') as SubmissionType;
  const content = formData.get('content') as string;

  if (!lessonId || !classId || !type || !content?.trim()) {
    return { error: '제출 유형과 내용을 모두 작성해 주세요.' };
  }

  const validTypes: SubmissionType[] = ['question', 'confusion', 'understood', 'explore'];
  if (!validTypes.includes(type)) {
    return { error: '유효하지 않은 제출 유형입니다.' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // 1. 수강생 소속 및 레슨 마감 상태 검사
  const { data: membership } = await supabase
    .from('class_members')
    .select('id')
    .eq('class_id', classId)
    .eq('student_id', user.id)
    .single();

  if (!membership) {
    return { error: '이 클래스에 참여 중인 학생만 제출할 수 있습니다.' };
  }

  const { data: lesson, error: lessonError } = await supabase
    .from('lessons')
    .select('status, deadline, class_id')
    .eq('id', lessonId)
    .eq('class_id', classId)
    .single();

  if (lessonError || !lesson) {
    return { error: '레슨 정보를 찾을 수 없습니다.' };
  }

  const isDeadlinePassed = lesson.deadline ? new Date(lesson.deadline) < new Date() : false;
  if (lesson.status === 'closed' || isDeadlinePassed) {
    return { error: '이 레슨은 질문 접수가 마감되어 제출할 수 없습니다.' };
  }

  // 2. 제출물 Upsert (신규 생성 또는 기존 제출물 수정)
  const { error: upsertError } = await supabase
    .from('submissions')
    .upsert(
      {
        lesson_id: lessonId,
        student_id: user.id,
        type,
        content: content.trim(),
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'lesson_id, student_id',
      }
    );

  if (upsertError) {
    return { error: '제출 중 오류가 발생했습니다: ' + upsertError.message };
  }

  revalidatePath(`/classes/${classId}/lessons/${lessonId}`);
  return { success: true };
}

