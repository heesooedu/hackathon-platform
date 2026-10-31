'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { clusterQuestionsWithGemini, AiSuggestedGroup } from '@/utils/gemini';
import { verifyClassTeacherAccess } from '@/utils/classTeacherAuth';
import { Submission } from '@/types/database.types';

export async function createQuestionGroup(formData: FormData) {
  const lessonId = formData.get('lesson_id') as string;
  const classId = formData.get('class_id') as string;
  const title = formData.get('representative_title') as string;
  const content = formData.get('representative_content') as string;
  const submissionIdsJson = formData.get('submission_ids') as string;

  if (!lessonId || !title?.trim() || !content?.trim()) {
    return { error: '대표 질문 제목과 설명을 모두 입력해 주세요.' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // 대표 교사 또는 공동 교사 권한 확인
  const access = await verifyClassTeacherAccess(supabase, classId, user.id);
  if (!access.classData || !access.isTeacher) {
    return { error: '담당 선생님만 대표 질문을 묶을 수 있습니다.' };
  }

  // 1. 대표 질문 그룹 생성
  const { data: group, error: groupError } = await supabase
    .from('question_groups')
    .insert({
      lesson_id: lessonId,
      representative_title: title.trim(),
      representative_content: content.trim(),
      is_published: true,
      is_resolved: false,
    })
    .select('id')
    .single();

  if (groupError || !group) {
    return { error: '대표 질문 생성 중 오류가 발생했습니다: ' + groupError?.message };
  }

  // 2. 묶인 원본 질문들 매핑 (불변성 보장)
  let submissionIds: string[] = [];
  try {
    submissionIds = JSON.parse(submissionIdsJson || '[]');
  } catch {
    submissionIds = [];
  }

  if (submissionIds.length > 0) {
    const memberRows = submissionIds.map((subId) => ({
      group_id: group.id,
      submission_id: subId,
    }));

    await supabase.from('question_group_members').insert(memberRows);
  }

  revalidatePath(`/classes/${classId}/lessons/${lessonId}`);
  return { success: true };
}

export async function toggleGroupResolved(
  groupId: string,
  classId: string,
  lessonId: string,
  currentStatus: boolean
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const access = await verifyClassTeacherAccess(supabase, classId, user.id);
  if (!access.classData || !access.isTeacher) {
    return { error: '담당 선생님만 질문 해결 상태를 변경할 수 있습니다.' };
  }

  const { error } = await supabase
    .from('question_groups')
    .update({ is_resolved: !currentStatus })
    .eq('id', groupId)
    .eq('lesson_id', lessonId);

  if (error) {
    return { error: '상태 변경 중 오류: ' + error.message };
  }

  revalidatePath(`/classes/${classId}/lessons/${lessonId}`);
  return { success: true, newStatus: !currentStatus };
}

export async function createAnswer(formData: FormData) {
  const groupId = formData.get('group_id') as string;
  const classId = formData.get('class_id') as string;
  const lessonId = formData.get('lesson_id') as string;
  const content = formData.get('content') as string;

  if (!groupId || !content?.trim()) {
    return { error: '답변 내용을 입력해 주세요.' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // 해당 학급의 담당 교사(대표 교사/공동 교사) 또는 수강 학생인지 확인
  const access = await verifyClassTeacherAccess(supabase, classId, user.id);
  const isTeacher = access.isTeacher;

  if (!isTeacher) {
    const { data: membership } = await supabase
      .from('class_members')
      .select('id')
      .eq('class_id', classId)
      .eq('student_id', user.id)
      .single();

    if (!membership) {
      return { error: '소속된 학급의 질문에만 답변을 작성할 수 있습니다.' };
    }
  }

  const { error } = await supabase.from('answers').insert({
    group_id: groupId,
    author_id: user.id,
    content: content.trim(),
    is_teacher_checked: isTeacher,
  });

  if (error) {
    return { error: '답변 등록 중 오류: ' + error.message };
  }

  revalidatePath(`/classes/${classId}/lessons/${lessonId}`);
  return { success: true };
}

export async function toggleAnswerChecked(
  answerId: string,
  classId: string,
  lessonId: string,
  currentStatus: boolean
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const access = await verifyClassTeacherAccess(supabase, classId, user.id);
  if (!access.classData || !access.isTeacher) {
    return { error: '담당 선생님만 답변 검증 상태를 변경할 수 있습니다.' };
  }

  const { error } = await supabase
    .from('answers')
    .update({ is_teacher_checked: !currentStatus })
    .eq('id', answerId);

  if (error) {
    return { error: '검증 변경 중 오류: ' + error.message };
  }

  revalidatePath(`/classes/${classId}/lessons/${lessonId}`);
  return { success: true, newStatus: !currentStatus };
}

export async function requestAiCluster(
  lessonId: string,
  learningObjective: string
): Promise<{ success: boolean; groups?: AiSuggestedGroup[]; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: '로그인이 필요합니다.' };

  // 해당 레슨의 담당 교사(대표 교사/공동 교사)인지 확인 (학생의 무단 AI 호출 차단)
  const { data: lessonData } = await supabase
    .from('lessons')
    .select('id, class_id')
    .eq('id', lessonId)
    .single();

  if (!lessonData) {
    return { success: false, error: '레슨 정보를 찾을 수 없습니다.' };
  }

  const access = await verifyClassTeacherAccess(supabase, lessonData.class_id, user.id);

  if (!access.classData || !access.isTeacher) {
    return { success: false, error: '담당 선생님만 AI 질문 묶기 추천을 실행할 수 있습니다.' };
  }

  const { data: submissions } = await supabase
    .from('submissions')
    .select('*')
    .eq('lesson_id', lessonId);

  if (!submissions || submissions.length === 0) {
    return { success: false, error: '분석할 학생 질문이 아직 없습니다.' };
  }

  const groups = await clusterQuestionsWithGemini(
    submissions as unknown as Submission[],
    learningObjective
  );

  if (!groups || groups.length === 0) {
    return {
      success: false,
      error: 'GEMINI_API_KEY가 설정되지 않았거나 질문 분석에 실패했습니다. 환경변수를 확인해 주세요.',
    };
  }

  return { success: true, groups };
}
