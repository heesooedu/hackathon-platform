import { createClient } from '@/utils/supabase/server';
import { ensureTeacherMaterialLibrary } from '@/app/lessons/actions';
import {
  isMaterialLibraryClass,
  parseLessonMaterial,
  sortLessonsByOrder,
} from '@/utils/materialPayload';
import { ClassItem, Lesson } from '@/types/database.types';
import { DeployedClassLink } from '@/components/MaterialLibraryDashboard';

export interface TeacherMaterialLibraryContext {
  libraryClassId: string | null;
  masterMaterials: Lesson[];
  teacherClasses: ClassItem[];
  deployedMap: Record<string, DeployedClassLink[]>;
  existingSubjects: string[];
  existingUnits: string[];
}

export async function loadTeacherMaterialLibraryContext(
  teacherId: string
): Promise<TeacherMaterialLibraryContext> {
  const supabase = await createClient();
  const { libraryClassId } = await ensureTeacherMaterialLibrary(teacherId);

  const { data: allClassesData } = await supabase
    .from('classes')
    .select('*, class_members(count)')
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false });

  const teacherClasses: ClassItem[] = (allClassesData || [])
    .filter((c: any) => !isMaterialLibraryClass(c))
    .map((c: any) => ({
      ...c,
      member_count: c.class_members?.[0]?.count || 0,
    }));

  if (!libraryClassId) {
    return {
      libraryClassId: null,
      masterMaterials: [],
      teacherClasses,
      deployedMap: {},
      existingSubjects: [],
      existingUnits: [],
    };
  }

  // 1. 보관함 원본 교안 조회
  const { data: rawMasters } = await supabase
    .from('lessons')
    .select('*')
    .eq('class_id', libraryClassId)
    .order('created_at', { ascending: false });

  const masterMaterials = sortLessonsByOrder((rawMasters || []) as Lesson[]);

  // 2. 일반 학급에 배포된 레슨들 조회 -> deployedMap 구성
  const deployedMap: Record<string, DeployedClassLink[]> = {};
  if (teacherClasses.length > 0) {
    const classIds = teacherClasses.map((c) => c.id);
    const classNameMap = new Map(teacherClasses.map((c) => [c.id, c.name]));

    const { data: classLessons } = await supabase
      .from('lessons')
      .select('id, class_id, title, material_html')
      .in('class_id', classIds);

    for (const cl of (classLessons || []) as Lesson[]) {
      const parsed = parseLessonMaterial(cl);
      const srcId = parsed.sourceMaterialId;
      if (srcId) {
        if (!deployedMap[srcId]) {
          deployedMap[srcId] = [];
        }
        // 같은 학급에 중복 표시 방지
        if (!deployedMap[srcId].some((d) => d.classId === cl.class_id)) {
          deployedMap[srcId].push({
            classId: cl.class_id,
            className: classNameMap.get(cl.class_id) || '학급',
            lessonId: cl.id,
          });
        }
      }
    }
  }

  // 3. 기존 과목명 / 단원명 자동완성 목록 추출
  const subjectSet = new Set<string>();
  const unitSet = new Set<string>();
  for (const m of masterMaterials) {
    const parsed = parseLessonMaterial(m);
    if (parsed.subjectCategory?.trim()) {
      subjectSet.add(parsed.subjectCategory.trim());
    }
    if (parsed.unitCategory?.trim()) {
      unitSet.add(parsed.unitCategory.trim());
    }
  }

  return {
    libraryClassId,
    masterMaterials,
    teacherClasses,
    deployedMap,
    existingSubjects: Array.from(subjectSet),
    existingUnits: Array.from(unitSet),
  };
}
