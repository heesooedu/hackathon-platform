'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { generateLessonReviewWithGemini } from '@/utils/gemini';
import { Submission, QuestionGroup, LessonStatus } from '@/types/database.types';

export async function createLesson(formData: FormData) {
  const classId = formData.get('class_id') as string;
  const title = formData.get('title') as string;
  const learningObjective = formData.get('learning_objective') as string;
  const deadlineStr = formData.get('deadline') as string;
  const materialHtml = formData.get('material_html') as string;

  if (!classId || !title?.trim() || !learningObjective?.trim()) {
    return { error: '레슨 제목과 학습 목표를 모두 입력해 주세요.' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // 교사 권한 확인
  const { data: classData, error: classError } = await supabase
    .from('classes')
    .select('teacher_id')
    .eq('id', classId)
    .single();

  if (classError || !classData || classData.teacher_id !== user.id) {
    return { error: '이 클래스에 레슨을 개설할 권한이 없습니다.' };
  }

  const deadline = deadlineStr ? new Date(deadlineStr).toISOString() : null;

  const { data: newLesson, error: lessonError } = await supabase
    .from('lessons')
    .insert({
      class_id: classId,
      title: title.trim(),
      learning_objective: learningObjective.trim(),
      deadline,
      status: 'open',
      material_html: materialHtml?.trim() || null,
    })
    .select('id')
    .single();

  if (lessonError || !newLesson) {
    return { error: '레슨 개설 중 오류가 발생했습니다: ' + lessonError?.message };
  }

  revalidatePath(`/classes/${classId}`);
  redirect(`/classes/${classId}/lessons/${newLesson.id}`);
}

export async function toggleLessonStatus(
  lessonId: string,
  classId: string,
  currentStatus: 'open' | 'closed'
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const newStatus: LessonStatus = currentStatus === 'open' ? 'closed' : 'open';

  const { error } = await supabase
    .from('lessons')
    .update({ status: newStatus })
    .eq('id', lessonId);

  if (error) {
    return { error: '상태 변경 중 오류: ' + error.message };
  }

  revalidatePath(`/classes/${classId}/lessons/${lessonId}`);
  return { success: true, newStatus };
}

export async function requestAiLessonReview(
  lessonId: string,
  learningObjective: string,
  lessonTitle: string
): Promise<{ success: boolean; report?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: '로그인이 필요합니다.' };

  // 1. 제출물 조회
  const { data: submissions } = await supabase
    .from('submissions')
    .select('*')
    .eq('lesson_id', lessonId);

  // 2. 대표 질문 그룹 조회
  const { data: groups } = await supabase
    .from('question_groups')
    .select('*')
    .eq('lesson_id', lessonId);

  const subList = (submissions || []) as unknown as Submission[];
  const groupList = (groups || []) as unknown as QuestionGroup[];

  if (subList.length === 0) {
    return {
      success: false,
      error: '아직 수집된 학생 질문이 없어 분석을 진행할 수 없습니다.',
    };
  }

  const report = await generateLessonReviewWithGemini(
    subList,
    groupList,
    learningObjective,
    lessonTitle
  );

  return { success: true, report };
}
