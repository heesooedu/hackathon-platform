'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { LessonStatus } from '@/types/database.types';

export async function createLesson(formData: FormData) {
  const classId = formData.get('class_id') as string;
  const title = formData.get('title') as string;
  const learningObjective = formData.get('learning_objective') as string;
  const deadlineInput = formData.get('deadline') as string;
  const materialHtml = formData.get('material_html') as string;

  if (!classId || !title?.trim() || !learningObjective?.trim()) {
    return { error: '레슨 제목과 학습 목표를 모두 입력해 주세요.' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // 마감일 포맷 처리
  let deadline: string | null = null;
  if (deadlineInput && deadlineInput.trim()) {
    deadline = new Date(deadlineInput).toISOString();
  }

  const { data, error } = await supabase
    .from('lessons')
    .insert({
      class_id: classId,
      title: title.trim(),
      learning_objective: learningObjective.trim(),
      deadline,
      material_html: materialHtml?.trim() || null,
      status: 'open',
    })
    .select('id')
    .single();

  if (error) {
    return { error: '레슨 개설 중 오류가 발생했습니다: ' + error.message };
  }

  revalidatePath(`/classes/${classId}`);
  redirect(`/classes/${classId}/lessons/${data.id}`);
}

export async function toggleLessonStatus(lessonId: string, classId: string, currentStatus: LessonStatus) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const nextStatus: LessonStatus = currentStatus === 'open' ? 'closed' : 'open';

  const { error } = await supabase
    .from('lessons')
    .update({ status: nextStatus })
    .eq('id', lessonId);

  if (error) {
    return { error: '상태 변경 중 오류가 발생했습니다: ' + error.message };
  }

  revalidatePath(`/classes/${classId}`);
  revalidatePath(`/classes/${classId}/lessons/${lessonId}`);
  return { success: true, newStatus: nextStatus };
}

