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
  MATERIAL_LIBRARY_CLASS_NAME,
  isMaterialLibraryClass,
} from '@/utils/materialPayload';
import {
  Submission,
  QuestionGroup,
  LessonStatus,
  Lesson,
  MaterialType,
  AiLessonAnalysisResult,
  GeneratedQuizDraft,
} from '@/types/database.types';

import { QUIZ_GROUP_PREFIX } from '@/utils/quizHelper';

function generateLibraryJoinCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let result = '#';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 교사 전용 '교안 보관함(Master Library)' 컨테이너 클래스를 조회하거나 자동 생성합니다.
 * 기존 클래스들에 이미 만들어 둔 레슨 중 아직 보관함에 연결(sourceMaterialId)되지 않은 교안이 있다면
 * 자동으로 보관함에 원본 교안을 등록하고 연결하여 기존 교안도 100% 분류·재사용할 수 있게 합니다.
 */
export async function ensureTeacherMaterialLibrary(
  teacherId: string
): Promise<{ libraryClassId: string | null; error?: string }> {
  const supabase = await createClient();

  const { data: allTeacherClasses, error: classErr } = await supabase
    .from('classes')
    .select('*')
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: true });

  if (classErr) {
    return { libraryClassId: null, error: classErr.message };
  }

  const classesList = allTeacherClasses || [];
  let libraryClass = classesList.find((c) => isMaterialLibraryClass(c));

  if (!libraryClass) {
    let attempts = 0;
    while (!libraryClass && attempts < 5) {
      attempts++;
      const code = generateLibraryJoinCode();
      const { data: created, error: createErr } = await supabase
        .from('classes')
        .insert({
          teacher_id: teacherId,
          name: MATERIAL_LIBRARY_CLASS_NAME,
          join_code: code,
        })
        .select('*')
        .single();

      if (!createErr && created) {
        libraryClass = created;
      }
    }
  }

  if (!libraryClass) {
    return { libraryClassId: null, error: '교안 보관함 초기화에 실패했습니다.' };
  }

  const normalClasses = classesList.filter((c) => !isMaterialLibraryClass(c));
  if (normalClasses.length > 0) {
    const normalClassIds = normalClasses.map((c) => c.id);
    const classMap = new Map(normalClasses.map((c) => [c.id, c.name]));

    const { data: existingLessons } = await supabase
      .from('lessons')
      .select('*')
      .in('class_id', normalClassIds)
      .order('created_at', { ascending: true });

    const unlinkedLessons = ((existingLessons || []) as Lesson[]).filter((l) => {
      const parsed = parseLessonMaterial(l);
      return !parsed.sourceMaterialId;
    });

    for (const lesson of unlinkedLessons) {
      const parsed = parseLessonMaterial(lesson);
      const inferredSubject =
        parsed.subjectCategory || classMap.get(lesson.class_id) || '기본 과목';
      const inferredUnit = parsed.unitCategory || '1단원 (기본)';

      const masterSerialized = serializeLessonMaterial({
        ...parsed,
        subjectCategory: inferredSubject,
        unitCategory: inferredUnit,
        aiAnalysis: null,
        sourceMaterialId: null,
      });

      const { data: insertedMaster } = await supabase
        .from('lessons')
        .insert({
          class_id: libraryClass.id,
          title: lesson.title,
          learning_objective: lesson.learning_objective,
          deadline: null,
          status: 'open',
          material_html: masterSerialized || null,
        })
        .select('id')
        .single();

      if (insertedMaster?.id) {
        const linkedSerialized = serializeLessonMaterial({
          ...parsed,
          subjectCategory: inferredSubject,
          unitCategory: inferredUnit,
          sourceMaterialId: insertedMaster.id,
        });

        await supabase
          .from('lessons')
          .update({ material_html: linkedSerialized || null })
          .eq('id', lesson.id);
      }
    }
  }

  return { libraryClassId: libraryClass.id };
}

/**
 * 원본 교안(masterMaterialId)의 최신 내용·보충 패치·분류 메타데이터를
 * 해당 교안을 불러와 사용 중인 모든 분반(A, B, C, D반)의 수업 레슨에 실시간 동기화합니다.
 * 각 분반의 고유 데이터(마감일, 오픈 상태, 표시 순서, 반별 AI 질문 진단 리포트)는 보존합니다.
 */
async function syncMasterToAllClassLessons(
  teacherId: string,
  masterLesson: Lesson
) {
  const supabase = await createClient();
  const masterParsed = parseLessonMaterial(masterLesson);

  const { data: teacherClasses } = await supabase
    .from('classes')
    .select('id, name, join_code')
    .eq('teacher_id', teacherId);

  const normalClassIds = (teacherClasses || [])
    .filter((c) => !isMaterialLibraryClass(c))
    .map((c) => c.id);

  if (normalClassIds.length === 0) return;

  const { data: allClassLessons } = await supabase
    .from('lessons')
    .select('*')
    .in('class_id', normalClassIds);

  const linkedLessons = ((allClassLessons || []) as Lesson[]).filter(
    (l) => parseLessonMaterial(l).sourceMaterialId === masterLesson.id
  );

  for (const classLesson of linkedLessons) {
    const classParsed = parseLessonMaterial(classLesson);
    const syncedSerialized = serializeLessonMaterial({
      materialType: masterParsed.materialType,
      markdownContent: masterParsed.markdownContent,
      htmlContent: masterParsed.htmlContent,
      fileName: masterParsed.fileName,
      appliedPatches: masterParsed.appliedPatches,
      subjectCategory: masterParsed.subjectCategory,
      unitCategory: masterParsed.unitCategory,
      sessionNumber: masterParsed.sessionNumber,
      pageIcon: masterParsed.pageIcon,
      sourceMaterialId: masterLesson.id,
      // 반별 고유 설정은 그대로 유지
      aiAnalysis: classParsed.aiAnalysis,
      displayOrder: classParsed.displayOrder,
    });

    await supabase
      .from('lessons')
      .update({
        title: masterLesson.title,
        learning_objective: masterLesson.learning_objective,
        material_html: syncedSerialized || null,
      })
      .eq('id', classLesson.id);
  }
}

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
 * 1-1. 교안 보관함(Master Library)에 새 교안 생성 또는 기존 원본 교안 수정
 * - 선택된 분반(deploy_class_ids)이 있으면 해당 분반들에도 자동으로 레슨을 배포/연동합니다.
 * - 이미 연동된 모든 분반(A, B, C, D반)의 교안도 최신 상태로 자동 동기화합니다.
 */
export async function saveMasterMaterialAction(formData: FormData) {
  const materialId = ((formData.get('material_id') as string) || '').trim();
  const returnClassId = ((formData.get('return_class_id') as string) || '').trim();
  const title = ((formData.get('title') as string) || '').trim();
  const learningObjective = ((formData.get('learning_objective') as string) || '').trim();
  const subjectCategory = ((formData.get('subject_category') as string) || '').trim() || '공통 과목';
  const unitCategory = ((formData.get('unit_category') as string) || '').trim() || '1단원';
  const sessionNumberRaw = ((formData.get('session_number') as string) || '').trim();
  const sessionNumber = sessionNumberRaw ? Number(sessionNumberRaw) : null;
  const pageIcon = ((formData.get('page_icon') as string) || '').trim() || '📖';
  const deadlineStr = ((formData.get('deadline') as string) || '').trim();
  const deployClassIdsRaw = ((formData.get('deploy_class_ids') as string) || '[]').trim();

  const materialType = ((formData.get('material_type') as string) || 'markdown') as MaterialType;
  const materialMarkdown = ((formData.get('material_markdown') as string) || '').trim();
  const materialHtml = ((formData.get('material_html') as string) || '').trim();
  const materialFileName = ((formData.get('material_file_name') as string) || '').trim() || null;

  if (!title || !learningObjective) {
    return { error: '교안 제목과 학습 목표를 모두 입력해 주세요.' };
  }

  let deployClassIds: string[] = [];
  try {
    const parsedIds = JSON.parse(deployClassIdsRaw);
    if (Array.isArray(parsedIds)) {
      deployClassIds = parsedIds.filter((id) => typeof id === 'string' && id.trim().length > 0);
    }
  } catch {
    deployClassIds = [];
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { libraryClassId, error: libErr } = await ensureTeacherMaterialLibrary(user.id);
  if (libErr || !libraryClassId) {
    return { error: libErr || '교안 보관함을 불러올 수 없습니다.' };
  }

  let savedMasterLesson: Lesson | null = null;

  if (materialId) {
    // 기존 원본 교안 수정
    const { data: existingMaster } = await supabase
      .from('lessons')
      .select('*')
      .eq('id', materialId)
      .single();

    if (!existingMaster) {
      return { error: '수정할 원본 교안을 찾을 수 없습니다.' };
    }

    const existingParsed = parseLessonMaterial(existingMaster as Lesson);
    const updatedSerialized = serializeLessonMaterial({
      materialType,
      markdownContent: materialMarkdown,
      htmlContent: materialHtml,
      fileName: materialFileName,
      appliedPatches: existingParsed.appliedPatches || [],
      aiAnalysis: existingParsed.aiAnalysis || null,
      displayOrder:
        sessionNumber !== null ? sessionNumber : existingParsed.displayOrder ?? null,
      subjectCategory,
      unitCategory,
      sessionNumber:
        sessionNumber !== null ? sessionNumber : existingParsed.sessionNumber ?? null,
      pageIcon,
      sourceMaterialId: null,
    });

    const { data: updatedRow, error: updateErr } = await supabase
      .from('lessons')
      .update({
        title,
        learning_objective: learningObjective,
        material_html: updatedSerialized || null,
      })
      .eq('id', materialId)
      .select('*')
      .single();

    if (updateErr || !updatedRow) {
      return { error: '교안 수정 중 오류가 발생했습니다: ' + updateErr?.message };
    }

    savedMasterLesson = updatedRow as Lesson;
    await syncMasterToAllClassLessons(user.id, savedMasterLesson);
  } else {
    // 새 원본 교안 생성
    const newSerialized = serializeLessonMaterial({
      materialType,
      markdownContent: materialMarkdown,
      htmlContent: materialHtml,
      fileName: materialFileName,
      appliedPatches: [],
      aiAnalysis: null,
      displayOrder: sessionNumber,
      subjectCategory,
      unitCategory,
      sessionNumber,
      pageIcon,
      sourceMaterialId: null,
    });

    const { data: createdRow, error: createErr } = await supabase
      .from('lessons')
      .insert({
        class_id: libraryClassId,
        title,
        learning_objective: learningObjective,
        deadline: null,
        status: 'open',
        material_html: newSerialized || null,
      })
      .select('*')
      .single();

    if (createErr || !createdRow) {
      return { error: '새 교안 저장 중 오류가 발생했습니다: ' + createErr?.message };
    }

    savedMasterLesson = createdRow as Lesson;
  }

  // 선택한 분반(A, B, C, D반)이 있으면 즉시 배포/연동
  if (savedMasterLesson && deployClassIds.length > 0) {
    await deployMaterialToClassesInternal(
      user.id,
      savedMasterLesson,
      deployClassIds,
      deadlineStr || null
    );
  }

  revalidatePath('/materials');
  revalidatePath('/', 'layout');

  if (returnClassId) {
    revalidatePath(`/classes/${returnClassId}`);
    redirect(`/classes/${returnClassId}`);
  }

  redirect('/materials');
}

/**
 * 내부 헬퍼: 특정 원본 교안(masterLesson)을 지정된 여러 분반(targetClassIds)에 배포합니다.
 */
async function deployMaterialToClassesInternal(
  teacherId: string,
  masterLesson: Lesson,
  targetClassIds: string[],
  deadlineStr: string | null
): Promise<{ deployedCount: number; alreadyLinkedCount: number }> {
  const supabase = await createClient();
  const masterParsed = parseLessonMaterial(masterLesson);
  const deadline = deadlineStr ? new Date(deadlineStr).toISOString() : null;

  // 교사 소유 클래스인지 확인
  const { data: validClasses } = await supabase
    .from('classes')
    .select('id, name, join_code')
    .eq('teacher_id', teacherId)
    .in('id', targetClassIds);

  const validClassIds = (validClasses || [])
    .filter((c) => !isMaterialLibraryClass(c))
    .map((c) => c.id);

  if (validClassIds.length === 0) {
    return { deployedCount: 0, alreadyLinkedCount: 0 };
  }

  const { data: existingLessons } = await supabase
    .from('lessons')
    .select('*')
    .in('class_id', validClassIds);

  const lessonsByClass = new Map<string, Lesson[]>();
  for (const l of (existingLessons || []) as Lesson[]) {
    const arr = lessonsByClass.get(l.class_id) || [];
    arr.push(l);
    lessonsByClass.set(l.class_id, arr);
  }

  let deployedCount = 0;
  let alreadyLinkedCount = 0;

  for (const classId of validClassIds) {
    const classLessons = lessonsByClass.get(classId) || [];
    const alreadyExists = classLessons.some(
      (l) => parseLessonMaterial(l).sourceMaterialId === masterLesson.id
    );

    if (alreadyExists) {
      alreadyLinkedCount++;
      continue;
    }

    const nextDisplayOrder =
      masterParsed.sessionNumber !== null && masterParsed.sessionNumber !== undefined
        ? masterParsed.sessionNumber
        : classLessons.length;

    const linkedSerialized = serializeLessonMaterial({
      materialType: masterParsed.materialType,
      markdownContent: masterParsed.markdownContent,
      htmlContent: masterParsed.htmlContent,
      fileName: masterParsed.fileName,
      appliedPatches: masterParsed.appliedPatches || [],
      aiAnalysis: null,
      displayOrder: nextDisplayOrder,
      subjectCategory: masterParsed.subjectCategory || null,
      unitCategory: masterParsed.unitCategory || null,
      sessionNumber: masterParsed.sessionNumber ?? null,
      pageIcon: masterParsed.pageIcon || null,
      sourceMaterialId: masterLesson.id,
    });

    const { error: insertErr } = await supabase.from('lessons').insert({
      class_id: classId,
      title: masterLesson.title,
      learning_objective: masterLesson.learning_objective,
      deadline,
      status: 'open',
      material_html: linkedSerialized || null,
    });

    if (!insertErr) {
      deployedCount++;
      revalidatePath(`/classes/${classId}`);
    }
  }

  return { deployedCount, alreadyLinkedCount };
}

/**
 * 1-2. 교안 보관함에서 선택한 교안을 여러 분반(A, B, C, D반)에 일괄 배포하는 서버 액션
 */
export async function deployMaterialToClassesAction(
  materialId: string,
  targetClassIds: string[],
  deadlineStr?: string | null
): Promise<{
  success: boolean;
  deployedCount?: number;
  alreadyLinkedCount?: number;
  error?: string;
}> {
  if (!materialId || targetClassIds.length === 0) {
    return { success: false, error: '배포할 교안과 대상 학급(분반)을 선택해 주세요.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: '로그인이 필요합니다.' };

  const { data: masterLesson } = await supabase
    .from('lessons')
    .select('*')
    .eq('id', materialId)
    .single();

  if (!masterLesson) {
    return { success: false, error: '원본 교안을 찾을 수 없습니다.' };
  }

  const { deployedCount, alreadyLinkedCount } = await deployMaterialToClassesInternal(
    user.id,
    masterLesson as Lesson,
    targetClassIds,
    deadlineStr || null
  );

  revalidatePath('/materials');
  revalidatePath('/', 'layout');
  return { success: true, deployedCount, alreadyLinkedCount };
}

/**
 * 1-3. 특정 분반(클래스 상세 화면) 안에서 교안 보관함의 교안 여러 개를 한 번에 불러오는 서버 액션
 */
export async function importMaterialsToClassAction(
  classId: string,
  materialIds: string[],
  deadlineStr?: string | null
): Promise<{
  success: boolean;
  importedCount?: number;
  error?: string;
}> {
  if (!classId || materialIds.length === 0) {
    return { success: false, error: '불러올 교안을 1개 이상 선택해 주세요.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: '로그인이 필요합니다.' };

  const { data: classData } = await supabase
    .from('classes')
    .select('id, teacher_id')
    .eq('id', classId)
    .single();

  if (!classData || classData.teacher_id !== user.id) {
    return { success: false, error: '이 클래스에 교안을 불러올 권한이 없습니다.' };
  }

  const { data: masterLessons } = await supabase
    .from('lessons')
    .select('*')
    .in('id', materialIds);

  if (!masterLessons || masterLessons.length === 0) {
    return { success: false, error: '선택한 교안 정보를 찾을 수 없습니다.' };
  }

  // 선택한 순서 유지
  const masterMap = new Map((masterLessons as Lesson[]).map((m) => [m.id, m]));
  let totalImported = 0;

  for (const matId of materialIds) {
    const master = masterMap.get(matId);
    if (!master) continue;
    const { deployedCount } = await deployMaterialToClassesInternal(
      user.id,
      master,
      [classId],
      deadlineStr || null
    );
    totalImported += deployedCount;
  }

  revalidatePath(`/classes/${classId}`);
  revalidatePath('/materials');
  return { success: true, importedCount: totalImported };
}

/**
 * 1-4. 교안 보관함의 원본 교안 복제 (다음 차시 교안 빠른 제작용)
 */
export async function duplicateMasterMaterialAction(
  materialId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: '로그인이 필요합니다.' };

  const { libraryClassId, error: libErr } = await ensureTeacherMaterialLibrary(user.id);
  if (libErr || !libraryClassId) {
    return { success: false, error: libErr || '교안 보관함을 확인할 수 없습니다.' };
  }

  const { data: original } = await supabase
    .from('lessons')
    .select('*')
    .eq('id', materialId)
    .single();

  if (!original) {
    return { success: false, error: '복제할 교안을 찾을 수 없습니다.' };
  }

  const parsed = parseLessonMaterial(original as Lesson);
  const nextSession =
    typeof parsed.sessionNumber === 'number' ? parsed.sessionNumber + 1 : null;

  const clonedSerialized = serializeLessonMaterial({
    ...parsed,
    sessionNumber: nextSession,
    displayOrder: nextSession,
    aiAnalysis: null,
    sourceMaterialId: null,
  });

  const { error: insertErr } = await supabase.from('lessons').insert({
    class_id: libraryClassId,
    title: `${original.title} (복사본)`,
    learning_objective: original.learning_objective,
    deadline: null,
    status: 'open',
    material_html: clonedSerialized || null,
  });

  if (insertErr) {
    return { success: false, error: '교안 복제 중 오류: ' + insertErr.message };
  }

  revalidatePath('/materials');
  return { success: true };
}

/**
 * 1-5. 교안 보관함에서 원본 교안 삭제
 */
export async function deleteMasterMaterialAction(
  materialId: string,
  alsoDeleteFromClasses = false
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: '로그인이 필요합니다.' };

  const { data: teacherClasses } = await supabase
    .from('classes')
    .select('id, name, join_code')
    .eq('teacher_id', user.id);

  const normalClassIds = (teacherClasses || [])
    .filter((c) => !isMaterialLibraryClass(c))
    .map((c) => c.id);

  if (normalClassIds.length > 0) {
    const { data: classLessons } = await supabase
      .from('lessons')
      .select('*')
      .in('class_id', normalClassIds);

    const linked = ((classLessons || []) as Lesson[]).filter(
      (l) => parseLessonMaterial(l).sourceMaterialId === materialId
    );

    for (const l of linked) {
      if (alsoDeleteFromClasses) {
        await supabase.from('lessons').delete().eq('id', l.id);
      } else {
        const parsed = parseLessonMaterial(l);
        const unlinkedSerialized = serializeLessonMaterial({
          ...parsed,
          sourceMaterialId: null,
        });
        await supabase
          .from('lessons')
          .update({ material_html: unlinkedSerialized || null })
          .eq('id', l.id);
      }
    }
  }

  const { error } = await supabase.from('lessons').delete().eq('id', materialId);
  if (error) {
    return { success: false, error: '교안 삭제 중 오류: ' + error.message };
  }

  revalidatePath('/materials');
  revalidatePath('/', 'layout');
  return { success: true };
}

/**
 * 1-6. 교안 보관함 내 과목/단원별 교안 순서 변경 저장 (드래그 앤 드롭)
 */
export async function reorderMasterMaterialsAction(
  orderedMaterialIds: string[]
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: '로그인이 필요합니다.' };

  const { data: materials } = await supabase
    .from('lessons')
    .select('*')
    .in('id', orderedMaterialIds);

  if (!materials) {
    return { success: false, error: '교안 목록을 불러올 수 없습니다.' };
  }

  const matMap = new Map((materials as Lesson[]).map((m) => [m.id, m]));

  for (let i = 0; i < orderedMaterialIds.length; i++) {
    const mat = matMap.get(orderedMaterialIds[i]);
    if (!mat) continue;
    const parsed = parseLessonMaterial(mat);
    const updatedSerialized = serializeLessonMaterial({
      ...parsed,
      displayOrder: i + 1,
      sessionNumber: i + 1,
    });
    await supabase
      .from('lessons')
      .update({ material_html: updatedSerialized || null })
      .eq('id', mat.id);
  }

  revalidatePath('/materials');
  return { success: true };
}

/**
 * 2. 새 레슨 개설 (클래스 내부에서 직접 생성할 때도 교안 보관함에 원본을 자동 등록하고 연동)
 */
export async function createLesson(formData: FormData) {
  const classId = formData.get('class_id') as string;
  const title = formData.get('title') as string;
  const learningObjective = formData.get('learning_objective') as string;
  const deadlineStr = formData.get('deadline') as string;
  const subjectCategory = ((formData.get('subject_category') as string) || '').trim() || null;
  const unitCategory = ((formData.get('unit_category') as string) || '').trim() || null;
  const sessionNumberRaw = ((formData.get('session_number') as string) || '').trim();
  const sessionNumber = sessionNumberRaw ? Number(sessionNumberRaw) : null;
  const pageIcon = ((formData.get('page_icon') as string) || '').trim() || '📖';

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
    .select('teacher_id, name')
    .eq('id', classId)
    .single();

  if (classError || !classData || classData.teacher_id !== user.id) {
    return { error: '이 클래스에 레슨을 개설할 권한이 없습니다.' };
  }

  // 교안 보관함에도 원본 교안 자동 등록
  const { libraryClassId } = await ensureTeacherMaterialLibrary(user.id);
  let masterMaterialId: string | null = null;
  const resolvedSubject = subjectCategory || classData.name || '기본 과목';
  const resolvedUnit = unitCategory || '1단원';

  if (libraryClassId) {
    const masterSerialized = serializeLessonMaterial({
      materialType,
      markdownContent: materialMarkdown,
      htmlContent: materialHtml,
      fileName: materialFileName,
      appliedPatches: [],
      aiAnalysis: null,
      displayOrder: sessionNumber,
      subjectCategory: resolvedSubject,
      unitCategory: resolvedUnit,
      sessionNumber,
      pageIcon,
      sourceMaterialId: null,
    });

    const { data: createdMaster } = await supabase
      .from('lessons')
      .insert({
        class_id: libraryClassId,
        title: title.trim(),
        learning_objective: learningObjective.trim(),
        deadline: null,
        status: 'open',
        material_html: masterSerialized || null,
      })
      .select('id')
      .single();

    if (createdMaster?.id) {
      masterMaterialId = createdMaster.id;
    }
  }

  const deadline = deadlineStr ? new Date(deadlineStr).toISOString() : null;

  const serializedMaterial = serializeLessonMaterial({
    materialType,
    markdownContent: materialMarkdown,
    htmlContent: materialHtml,
    fileName: materialFileName,
    appliedPatches: [],
    aiAnalysis: null,
    displayOrder: sessionNumber,
    subjectCategory: resolvedSubject,
    unitCategory: resolvedUnit,
    sessionNumber,
    pageIcon,
    sourceMaterialId: masterMaterialId,
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

  revalidatePath('/materials');
  revalidatePath(`/classes/${classId}`);
  redirect(`/classes/${classId}/lessons/${newLesson.id}`);
}

/**
 * 2-1. 기존 레슨 및 교안 통합 수정 (원본 교안 및 동일 교안을 쓰는 타 분반에도 자동 동기화)
 */
export async function updateLessonAction(formData: FormData) {
  const lessonId = formData.get('lesson_id') as string;
  const classId = formData.get('class_id') as string;
  const title = formData.get('title') as string;
  const learningObjective = formData.get('learning_objective') as string;
  const deadlineStr = formData.get('deadline') as string;
  const subjectCategoryInput = ((formData.get('subject_category') as string) || '').trim();
  const unitCategoryInput = ((formData.get('unit_category') as string) || '').trim();
  const sessionNumberRaw = ((formData.get('session_number') as string) || '').trim();
  const pageIconInput = ((formData.get('page_icon') as string) || '').trim();

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

  const nextSubject = subjectCategoryInput || existingParsed.subjectCategory || null;
  const nextUnit = unitCategoryInput || existingParsed.unitCategory || null;
  const nextSession = sessionNumberRaw
    ? Number(sessionNumberRaw)
    : existingParsed.sessionNumber ?? null;
  const nextIcon = pageIconInput || existingParsed.pageIcon || null;

  const serializedMaterial = serializeLessonMaterial({
    materialType,
    markdownContent: materialMarkdown,
    htmlContent: materialHtml,
    fileName: materialFileName,
    appliedPatches: existingParsed.appliedPatches || [],
    aiAnalysis: existingParsed.aiAnalysis || null,
    displayOrder: existingParsed.displayOrder ?? null,
    subjectCategory: nextSubject,
    unitCategory: nextUnit,
    sessionNumber: nextSession,
    pageIcon: nextIcon,
    sourceMaterialId: existingParsed.sourceMaterialId || null,
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

  // 연결된 원본 교안(sourceMaterialId)이 있으면 원본 및 다른 분반(B·C·D반)도 동기화
  if (existingParsed.sourceMaterialId) {
    const masterSerialized = serializeLessonMaterial({
      materialType,
      markdownContent: materialMarkdown,
      htmlContent: materialHtml,
      fileName: materialFileName,
      appliedPatches: existingParsed.appliedPatches || [],
      aiAnalysis: null,
      displayOrder: nextSession,
      subjectCategory: nextSubject,
      unitCategory: nextUnit,
      sessionNumber: nextSession,
      pageIcon: nextIcon,
      sourceMaterialId: null,
    });

    const { data: updatedMaster } = await supabase
      .from('lessons')
      .update({
        title: title.trim(),
        learning_objective: learningObjective.trim(),
        material_html: masterSerialized || null,
      })
      .eq('id', existingParsed.sourceMaterialId)
      .select('*')
      .single();

    if (updatedMaster) {
      await syncMasterToAllClassLessons(user.id, updatedMaster as Lesson);
    }
  }

  revalidatePath('/materials');
  revalidatePath(`/classes/${classId}`);
  revalidatePath(`/classes/${classId}/lessons/${lessonId}`);
  redirect(`/classes/${classId}/lessons/${lessonId}`);
}

/**
 * 2-2. 학급 내 레슨 삭제 (학급에서만 제거하며 교안 보관함의 원본 교안은 안전하게 유지됨)
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

  revalidatePath('/materials');
  revalidatePath(`/classes/${classId}`);
  return { success: true };
}

/**
 * 2-3. 클래스 내 수업 교안(레슨) 목록 순서 변경 저장 (드래그 앤 드롭 재정렬)
 */
export async function reorderLessonsAction(
  classId: string,
  orderedLessonIds: string[]
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
    return { success: false, error: '교안 순서를 변경할 권한이 없습니다.' };
  }

  const { data: lessonsData, error: fetchError } = await supabase
    .from('lessons')
    .select('*')
    .eq('class_id', classId);

  if (fetchError || !lessonsData) {
    return { success: false, error: '레슨 목록을 불러올 수 없습니다.' };
  }

  const lessonMap = new Map<string, Lesson>(
    (lessonsData as Lesson[]).map((l) => [l.id, l])
  );

  for (let i = 0; i < orderedLessonIds.length; i++) {
    const lessonId = orderedLessonIds[i];
    const lesson = lessonMap.get(lessonId);
    if (!lesson) continue;

    const parsed = parseLessonMaterial(lesson);
    const updatedSerialized = serializeLessonMaterial({
      ...parsed,
      displayOrder: i,
    });

    await supabase
      .from('lessons')
      .update({ material_html: updatedSerialized || null })
      .eq('id', lessonId)
      .eq('class_id', classId);
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

  // 분석 결과를 해당 분반의 레슨 메타데이터에 캐싱
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
 * 5. 원클릭 교안 보충 패치 적용
 * - A반 수업 후 패치를 적용하면 원본 교안(sourceMaterialId) 및 동일 교안을 쓰는 B, C, D반에도 보충 패치가 실시간 동기화됩니다!
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

  const nextPatches = [...parsed.appliedPatches, newPatch];

  const updatedSerialized = serializeLessonMaterial({
    ...parsed,
    appliedPatches: nextPatches,
  });

  const { error: updateErr } = await supabase
    .from('lessons')
    .update({ material_html: updatedSerialized })
    .eq('id', lessonId);

  if (updateErr) {
    return { success: false, error: '교안 패치 저장 실패: ' + updateErr.message };
  }

  // 원본 교안(sourceMaterialId)이 연결되어 있으면 원본 및 타 분반(B·C·D반)에도 보충 패치 동기화!
  if (parsed.sourceMaterialId) {
    const { data: masterData } = await supabase
      .from('lessons')
      .select('*')
      .eq('id', parsed.sourceMaterialId)
      .single();

    if (masterData) {
      const masterParsed = parseLessonMaterial(masterData as Lesson);
      const updatedMasterSerialized = serializeLessonMaterial({
        ...masterParsed,
        appliedPatches: nextPatches,
      });

      const { data: updatedMaster } = await supabase
        .from('lessons')
        .update({ material_html: updatedMasterSerialized })
        .eq('id', parsed.sourceMaterialId)
        .select('*')
        .single();

      if (updatedMaster) {
        await syncMasterToAllClassLessons(user.id, updatedMaster as Lesson);
      }
    }
  }

  revalidatePath('/materials');
  revalidatePath(`/classes/${classId}/lessons/${lessonId}`);
  return { success: true };
}

/**
 * 6. 적용된 교안 보충 패치 삭제 (원본 교안 및 타 분반과도 동기화)
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
  const nextPatches = parsed.appliedPatches.filter((p) => p.id !== patchId);

  const updatedSerialized = serializeLessonMaterial({
    ...parsed,
    appliedPatches: nextPatches,
  });

  const { error } = await supabase
    .from('lessons')
    .update({ material_html: updatedSerialized })
    .eq('id', lessonId);

  if (error) {
    return { success: false, error: '패치 삭제 실패: ' + error.message };
  }

  if (parsed.sourceMaterialId) {
    const { data: masterData } = await supabase
      .from('lessons')
      .select('*')
      .eq('id', parsed.sourceMaterialId)
      .single();

    if (masterData) {
      const masterParsed = parseLessonMaterial(masterData as Lesson);
      const updatedMasterSerialized = serializeLessonMaterial({
        ...masterParsed,
        appliedPatches: nextPatches,
      });

      const { data: updatedMaster } = await supabase
        .from('lessons')
        .update({ material_html: updatedMasterSerialized })
        .eq('id', parsed.sourceMaterialId)
        .select('*')
        .single();

      if (updatedMaster) {
        await syncMasterToAllClassLessons(user.id, updatedMaster as Lesson);
      }
    }
  }

  revalidatePath('/materials');
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
 * 7-1. 교안 본문(노션 블록 마크다운 또는 HTML 시뮬레이터) 직접 수정 및 업데이트 (원본 및 타 분반 동기화 포함)
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
  const nextMarkdown =
    materialType === 'markdown' ? newMarkdown.trim() : parsed.markdownContent;
  const nextHtml =
    materialType === 'html' ? newHtml.trim() : parsed.htmlContent;
  const nextFileName = newFileName !== undefined ? newFileName : parsed.fileName;

  const updatedSerialized = serializeLessonMaterial({
    ...parsed,
    materialType,
    markdownContent: nextMarkdown,
    htmlContent: nextHtml,
    fileName: nextFileName,
  });

  const { error } = await supabase
    .from('lessons')
    .update({ material_html: updatedSerialized })
    .eq('id', lessonId);

  if (error) {
    return { success: false, error: '교안 수정 중 오류가 발생했습니다: ' + error.message };
  }

  if (parsed.sourceMaterialId) {
    const { data: masterData } = await supabase
      .from('lessons')
      .select('*')
      .eq('id', parsed.sourceMaterialId)
      .single();

    if (masterData) {
      const masterParsed = parseLessonMaterial(masterData as Lesson);
      const updatedMasterSerialized = serializeLessonMaterial({
        ...masterParsed,
        materialType,
        markdownContent: nextMarkdown,
        htmlContent: nextHtml,
        fileName: nextFileName,
      });

      const { data: updatedMaster } = await supabase
        .from('lessons')
        .update({ material_html: updatedMasterSerialized })
        .eq('id', parsed.sourceMaterialId)
        .select('*')
        .single();

      if (updatedMaster) {
        await syncMasterToAllClassLessons(user.id, updatedMaster as Lesson);
      }
    }
  }

  revalidatePath('/materials');
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

  const { data: lessonData } = await supabase
    .from('lessons')
    .select('*')
    .eq('id', lessonId)
    .single();

  const existingParsed = lessonData ? parseLessonMaterial(lessonData as Lesson) : null;
  const clearedSerialized = serializeLessonMaterial({
    materialType: 'markdown',
    markdownContent: '',
    htmlContent: '',
    fileName: null,
    appliedPatches: [],
    aiAnalysis: existingParsed?.aiAnalysis || null,
    displayOrder: existingParsed?.displayOrder ?? null,
    subjectCategory: existingParsed?.subjectCategory || null,
    unitCategory: existingParsed?.unitCategory || null,
    sessionNumber: existingParsed?.sessionNumber ?? null,
    pageIcon: existingParsed?.pageIcon || null,
    sourceMaterialId: existingParsed?.sourceMaterialId || null,
  });

  const { error } = await supabase
    .from('lessons')
    .update({ material_html: clearedSerialized || null })
    .eq('id', lessonId);

  if (error) {
    return { success: false, error: '교안 본문 삭제 중 오류가 발생했습니다: ' + error.message };
  }

  revalidatePath(`/classes/${classId}`);
  revalidatePath(`/classes/${classId}/lessons/${lessonId}`);
  return { success: true };
}

/**
 * 8. 오개념 타겟팅 형성평가 문항 학생 화면 배포 (각 분반별로 독립 배포)
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
