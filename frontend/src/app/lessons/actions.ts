'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { analyzeMaterialAndGenerateQuizWithGemini } from '@/utils/gemini';
import { parseUploadedDocument } from '@/utils/documentParser';
import {
  parseLessonMaterial,
  serializeLessonMaterial,
  getReadableMaterialTextForAi,
} from '@/utils/materialPayload';
import {
  Submission,
  QuestionGroup,
  LessonStatus,
  Lesson,
  MaterialType,
  AiLessonAnalysisResult,
  GeneratedQuizDraft,
  FormativeQuiz,
  QuizAttempt,
} from '@/types/database.types';

import { QUIZ_GROUP_PREFIX } from '@/utils/quizHelper';

/**
 * 1. 워드(.docx), 한글(.hwp, .hwpx), 마크다운(.md), 텍스트(.txt) 파일에서 교안 본문 추출 서버 액션
 */
export async function parseMaterialFileAction(formData: FormData) {
  const file = formData.get('file') as File | null;
  if (!file) {
    return { success: false, error: '파일이 선택되지 않았습니다.' };
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const result = await parseUploadedDocument(file.name, buffer);
    return result;
  } catch (err: unknown) {
    console.error('Error parsing uploaded file:', err);
    return {
      success: false,
      error: '파일을 읽는 중 오류가 발생했습니다.',
    };
  }
}

/**
 * 2. 새 레슨 개설 (마크다운/파일 업로드 교안 및 HTML 인터랙티브 교안 모두 지원)
 */
export async function createLesson(formData: FormData) {
  const classId = formData.get('class_id') as string;
  const title = formData.get('title') as string;
  const learningObjective = formData.get('learning_objective') as string;
  const deadlineStr = formData.get('deadline') as string;

  const materialType = ((formData.get('material_type') as string) || 'markdown') as MaterialType;
  const materialMarkdown = ((formData.get('material_markdown') as string) || '').trim();
  const materialHtml = ((formData.get('material_html') as string) || '').trim();
  const materialFileName = ((formData.get('material_file_name') as string) || '').trim() || null;

  if (!classId || !title?.trim() || !learningObjective?.trim()) {
    return { error: '레슨 제목과 학습 목표를 모두 입력해 주세요.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  const serializedMaterial = serializeLessonMaterial({
    materialType,
    markdownContent: materialMarkdown,
    htmlContent: materialHtml,
    fileName: materialFileName,
    appliedPatches: [],
    aiAnalysis: null,
  });

  const { data: newLesson, error: lessonError } = await supabase
    .from('lessons')
    .insert({
      class_id: classId,
      title: title.trim(),
      learning_objective: learningObjective.trim(),
      deadline,
      status: 'open',
      material_html: serializedMaterial || null,
    })
    .select('id')
    .single();

  if (lessonError || !newLesson) {
    return { error: '레슨 개설 중 오류가 발생했습니다: ' + lessonError?.message };
  }

  revalidatePath(`/classes/${classId}`);
  redirect(`/classes/${classId}/lessons/${newLesson.id}`);
}

/**
 * 2-1. 기존 레슨 및 교안 통합 수정 (노션 스튜디오 전체 화면 수정용)
 */
export async function updateLessonAction(formData: FormData) {
  const lessonId = formData.get('lesson_id') as string;
  const classId = formData.get('class_id') as string;
  const title = formData.get('title') as string;
  const learningObjective = formData.get('learning_objective') as string;
  const deadlineStr = formData.get('deadline') as string;

  const materialType = ((formData.get('material_type') as string) || 'markdown') as MaterialType;
  const materialMarkdown = ((formData.get('material_markdown') as string) || '').trim();
  const materialHtml = ((formData.get('material_html') as string) || '').trim();
  const materialFileName = ((formData.get('material_file_name') as string) || '').trim() || null;

  if (!lessonId || !classId || !title?.trim() || !learningObjective?.trim()) {
    return { error: '레슨 제목과 학습 목표를 모두 입력해 주세요.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
    return { error: '이 레슨을 수정할 권한이 없습니다.' };
  }

  const { data: existingLesson } = await supabase
    .from('lessons')
    .select('*')
    .eq('id', lessonId)
    .single();

  const existingParsed = parseLessonMaterial((existingLesson as Lesson) || null);
  const deadline = deadlineStr ? new Date(deadlineStr).toISOString() : null;

  const serializedMaterial = serializeLessonMaterial({
    materialType,
    markdownContent: materialMarkdown,
    htmlContent: materialHtml,
    fileName: materialFileName,
    appliedPatches: existingParsed.appliedPatches || [],
    aiAnalysis: existingParsed.aiAnalysis || null,
  });

  const { error: updateError } = await supabase
    .from('lessons')
    .update({
      title: title.trim(),
      learning_objective: learningObjective.trim(),
      deadline,
      material_html: serializedMaterial || null,
    })
    .eq('id', lessonId);

  if (updateError) {
    return { error: '레슨 수정 중 오류가 발생했습니다: ' + updateError.message };
  }

  revalidatePath(`/classes/${classId}`);
  revalidatePath(`/classes/${classId}/lessons/${lessonId}`);
  redirect(`/classes/${classId}/lessons/${lessonId}`);
}

/**
 * 2-2. 레슨(교안 포함) 완전 삭제
 */
export async function deleteLessonAction(
  lessonId: string,
  classId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: '로그인이 필요합니다.' };
  }

  // 교사 권한 확인
  const { data: classData, error: classError } = await supabase
    .from('classes')
    .select('teacher_id')
    .eq('id', classId)
    .single();

  if (classError || !classData || classData.teacher_id !== user.id) {
    return { success: false, error: '이 레슨을 삭제할 권한이 없습니다.' };
  }

  const { error: deleteError } = await supabase
    .from('lessons')
    .delete()
    .eq('id', lessonId)
    .eq('class_id', classId);

  if (deleteError) {
    return { success: false, error: '레슨 삭제 중 오류가 발생했습니다: ' + deleteError.message };
  }

  revalidatePath(`/classes/${classId}`);
  return { success: true };
}

/**
 * 3. 레슨 상태(open / closed) 토글
 */
export async function toggleLessonStatus(
  lessonId: string,
  classId: string,
  currentStatus: 'open' | 'closed'
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

/**
 * 4. Gemini 기반 교안 취약점(Gap) 진단 + 보충 패치 생성 + 맞춤형 형성평가 생성
 */
export async function requestAiLessonReview(
  lessonId: string,
  classId: string,
  learningObjective: string,
  lessonTitle: string
): Promise<{
  success: boolean;
  analysis?: AiLessonAnalysisResult;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: '로그인이 필요합니다.' };

  // 1. 레슨 교안 원문 조회
  const { data: lessonData } = await supabase
    .from('lessons')
    .select('*')
    .eq('id', lessonId)
    .single();

  if (!lessonData) {
    return { success: false, error: '레슨 정보를 찾을 수 없습니다.' };
  }

  const parsedMaterial = parseLessonMaterial(lessonData as Lesson);
  const readableMaterialText = getReadableMaterialTextForAi(parsedMaterial);

  // 2. 제출물 조회
  const { data: submissions } = await supabase
    .from('submissions')
    .select('*')
    .eq('lesson_id', lessonId);

  // 3. 대표 질문 그룹 조회
  const { data: groups } = await supabase
    .from('question_groups')
    .select('*')
    .eq('lesson_id', lessonId);

  const subList = (submissions || []) as unknown as Submission[];
  const groupList = (groups || []) as unknown as QuestionGroup[];

  if (subList.length === 0) {
    return {
      success: false,
      error: '아직 수집된 학생 질문이 없어 교안 대비 분석을 진행할 수 없습니다.',
    };
  }

  const aiRes = await analyzeMaterialAndGenerateQuizWithGemini(
    subList,
    groupList,
    learningObjective,
    lessonTitle,
    readableMaterialText
  );

  if (!aiRes.success || !aiRes.analysis) {
    return { success: false, error: aiRes.error || 'AI 분석 중 오류가 발생했습니다.' };
  }

  // 분석 결과를 레슨 메타데이터에 영구 캐싱
  const updatedSerialized = serializeLessonMaterial({
    ...parsedMaterial,
    aiAnalysis: aiRes.analysis,
  });

  await supabase
    .from('lessons')
    .update({ material_html: updatedSerialized })
    .eq('id', lessonId);

  revalidatePath(`/classes/${classId}/lessons/${lessonId}`);
  return { success: true, analysis: aiRes.analysis };
}

/**
 * 5. 원클릭 교안 보충 패치 적용 (AI가 제안한 보충 설명이나 교사가 수정한 패치를 학생 교안 화면에 즉시 반영)
 */
export async function applyMaterialPatchAction(
  lessonId: string,
  classId: string,
  patchTitle: string,
  patchMarkdown: string,
  sourceQuestionsSummary?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: '로그인이 필요합니다.' };

  const { data: lessonData, error: fetchErr } = await supabase
    .from('lessons')
    .select('*')
    .eq('id', lessonId)
    .single();

  if (fetchErr || !lessonData) {
    return { success: false, error: '레슨 정보를 불러올 수 없습니다.' };
  }

  const parsed = parseLessonMaterial(lessonData as Lesson);

  const newPatch = {
    id: `patch-${Date.now()}`,
    title: patchTitle.trim(),
    content_markdown: patchMarkdown.trim(),
    applied_at: new Date().toISOString(),
    source_questions_summary: sourceQuestionsSummary,
  };

  const updatedSerialized = serializeLessonMaterial({
    ...parsed,
    appliedPatches: [...parsed.appliedPatches, newPatch],
  });

  const { error: updateErr } = await supabase
    .from('lessons')
    .update({ material_html: updatedSerialized })
    .eq('id', lessonId);

  if (updateErr) {
    return { success: false, error: '교안 패치 저장 실패: ' + updateErr.message };
  }

  revalidatePath(`/classes/${classId}/lessons/${lessonId}`);
  return { success: true };
}

/**
 * 6. 적용된 교안 보충 패치 삭제
 */
export async function removeMaterialPatchAction(
  lessonId: string,
  classId: string,
  patchId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: '로그인이 필요합니다.' };

  const { data: lessonData } = await supabase
    .from('lessons')
    .select('*')
    .eq('id', lessonId)
    .single();

  if (!lessonData) {
    return { success: false, error: '레슨을 찾을 수 없습니다.' };
  }

  const parsed = parseLessonMaterial(lessonData as Lesson);
  const updatedSerialized = serializeLessonMaterial({
    ...parsed,
    appliedPatches: parsed.appliedPatches.filter((p) => p.id !== patchId),
  });

  const { error } = await supabase
    .from('lessons')
    .update({ material_html: updatedSerialized })
    .eq('id', lessonId);

  if (error) {
    return { success: false, error: '패치 삭제 실패: ' + error.message };
  }

  revalidatePath(`/classes/${classId}/lessons/${lessonId}`);
  return { success: true };
}

/**
 * 7. 교안 본문(마크다운) 직접 수정 및 업데이트
 */
export async function updateLessonMaterialMarkdownAction(
  lessonId: string,
  classId: string,
  newMarkdown: string,
  newFileName?: string | null
): Promise<{ success: boolean; error?: string }> {
  return updateLessonMaterialAction(
    lessonId,
    classId,
    'markdown',
    newMarkdown,
    '',
    newFileName
  );
}

/**
 * 7-1. 교안 본문(노션 블록 마크다운 또는 HTML 시뮬레이터) 직접 수정 및 업데이트
 */
export async function updateLessonMaterialAction(
  lessonId: string,
  classId: string,
  materialType: MaterialType,
  newMarkdown: string,
  newHtml: string,
  newFileName?: string | null
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: '로그인이 필요합니다.' };

  const { data: lessonData } = await supabase
    .from('lessons')
    .select('*')
    .eq('id', lessonId)
    .single();

  if (!lessonData) {
    return { success: false, error: '레슨을 찾을 수 없습니다.' };
  }

  const parsed = parseLessonMaterial(lessonData as Lesson);
  const updatedSerialized = serializeLessonMaterial({
    ...parsed,
    materialType,
    markdownContent: materialType === 'markdown' ? newMarkdown.trim() : parsed.markdownContent,
    htmlContent: materialType === 'html' ? newHtml.trim() : parsed.htmlContent,
    fileName: newFileName !== undefined ? newFileName : parsed.fileName,
  });

  const { error } = await supabase
    .from('lessons')
    .update({ material_html: updatedSerialized })
    .eq('id', lessonId);

  if (error) {
    return { success: false, error: '교안 수정 중 오류가 발생했습니다: ' + error.message };
  }

  revalidatePath(`/classes/${classId}`);
  revalidatePath(`/classes/${classId}/lessons/${lessonId}`);
  return { success: true };
}

/**
 * 7-2. 교안 본문만 삭제(비우기) — 학생 질문·제출물은 그대로 유지
 */
export async function clearLessonMaterialAction(
  lessonId: string,
  classId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: '로그인이 필요합니다.' };

  const { error } = await supabase
    .from('lessons')
    .update({ material_html: null })
    .eq('id', lessonId);

  if (error) {
    return { success: false, error: '교안 본문 삭제 중 오류가 발생했습니다: ' + error.message };
  }

  revalidatePath(`/classes/${classId}`);
  revalidatePath(`/classes/${classId}/lessons/${lessonId}`);
  return { success: true };
}

/**
 * 8. 오개념 타겟팅 형성평가 문항 학생 화면 배포
 * (formative_quizzes 테이블이 있으면 사용하고, 마이그레이션 전이면 question_groups [__QUIZ__] 엔티티로 완벽 호환 저장)
 */
export async function publishFormativeQuizzesAction(
  lessonId: string,
  classId: string,
  quizzes: GeneratedQuizDraft[]
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: '로그인이 필요합니다.' };

  if (!quizzes || quizzes.length === 0) {
    return { success: false, error: '배포할 문항이 없습니다.' };
  }

  // 기존에 배포된 [__QUIZ__] 그룹 정리 후 새로 등록
  const { data: existingGroups } = await supabase
    .from('question_groups')
    .select('id, representative_title')
    .eq('lesson_id', lessonId);

  const oldQuizGroupIds = (existingGroups || [])
    .filter((g) => g.representative_title.startsWith(QUIZ_GROUP_PREFIX))
    .map((g) => g.id);

  if (oldQuizGroupIds.length > 0) {
    await supabase.from('question_groups').delete().in('id', oldQuizGroupIds);
  }

  const rowsToInsert = quizzes.map((q, idx) => ({
    lesson_id: lessonId,
    representative_title: `${QUIZ_GROUP_PREFIX}Q${idx + 1}. ${q.question_text}`,
    representative_content: JSON.stringify({
      question_text: q.question_text,
      options: q.options,
      correct_option_index: q.correct_option_index,
      explanation: q.explanation,
      rationale: q.rationale,
      target_concept: q.target_concept,
    }),
    is_published: true,
    is_resolved: false,
  }));

  const { error } = await supabase.from('question_groups').insert(rowsToInsert);

  if (error) {
    return {
      success: false,
      error: '형성평가 배포 중 오류가 발생했습니다: ' + error.message,
    };
  }

  revalidatePath(`/classes/${classId}/lessons/${lessonId}`);
  return { success: true };
}

/**
 * 9. 학생의 형성평가 문항 풀이 제출 및 즉시 채점 기록
 */
export async function submitQuizAnswerAction(
  lessonId: string,
  classId: string,
  quizId: string,
  selectedOptionIndex: number,
  isCorrect: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: '로그인이 필요합니다.' };

  const payloadStr = JSON.stringify({
    __type: 'QUIZ_ATTEMPT',
    selected_option_index: selectedOptionIndex,
    is_correct: isCorrect,
  });

  // 기존에 이 학생이 해당 문항에 제출한 답안이 있는지 확인
  const { data: existingAnswers } = await supabase
    .from('answers')
    .select('id')
    .eq('group_id', quizId)
    .eq('author_id', user.id);

  if (existingAnswers && existingAnswers.length > 0) {
    const { error } = await supabase
      .from('answers')
      .update({ content: payloadStr })
      .eq('id', existingAnswers[0].id);

    if (error) {
      return { success: false, error: '답안 수정 중 오류: ' + error.message };
    }
  } else {
    const { error } = await supabase.from('answers').insert({
      group_id: quizId,
      author_id: user.id,
      content: payloadStr,
      is_teacher_checked: isCorrect,
    });

    if (error) {
      return { success: false, error: '답안 제출 중 오류: ' + error.message };
    }
  }

  revalidatePath(`/classes/${classId}/lessons/${lessonId}`);
  return { success: true };
}
