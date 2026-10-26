import { createClient } from '@/utils/supabase/server';
import { ensureTeacherMaterialLibrary } from '@/app/lessons/actions';
import {
  isMaterialLibraryClass,
  parseLessonMaterial,
  sortLessonsByOrder,
  toLightweightLessonForList,
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

export interface LoadMaterialLibraryOptions {
  /** 분반별 배포 현황(deployedMap) 조회 여부 (기본값: true, 홈/클래스 상세 등 불필요한 곳에서는 false) */
  includeDeployedMap?: boolean;
  /** 클라이언트 목록 전달 시 대용량 본문(markdown/html/base64 이미지) 경량화 여부 */
  lightweightMasterMaterials?: boolean;
}

export async function loadTeacherMaterialLibraryContext(
  teacherId: string,
  options: LoadMaterialLibraryOptions = {}
): Promise<TeacherMaterialLibraryContext> {
  const {
    includeDeployedMap = true,
    lightweightMasterMaterials = false,
  } = options;

  const supabase = await createClient();

  // 1. 교사의 전체 클래스(보관함 컨테이너 포함)를 단 1회 쿼리로 조회
  const { data: allClassesData } = await supabase
    .from('classes')
    .select('*, class_members(count)')
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false });

  const allRows = allClassesData || [];
  const existingLibraryClass = allRows.find((c: any) =>
    isMaterialLibraryClass(c)
  );

  const teacherClasses: ClassItem[] = allRows
    .filter((c: any) => !isMaterialLibraryClass(c))
    .map((c: any) => ({
      ...c,
      member_count: c.class_members?.[0]?.count || 0,
    }));

  // 보관함이 아직 없는 신규 교사 계정일 때만 최초 1회 생성 및 레거시 마이그레이션 실행
  let libraryClassId: string | null = existingLibraryClass?.id ?? null;
  if (!libraryClassId) {
    const ensured = await ensureTeacherMaterialLibrary(teacherId);
    libraryClassId = ensured.libraryClassId;
  }

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

  // 2. 보관함 원본 교안 조회와 (필요 시) 일반 학급 배포 레슨 조회를 병렬(Promise.all)로 동시 실행
  const classIds = teacherClasses.map((c) => c.id);
  const shouldFetchDeployed = includeDeployedMap && classIds.length > 0;

  const [{ data: rawMasters }, { data: classLessons }] = await Promise.all([
    supabase
      .from('lessons')
      .select('*')
      .eq('class_id', libraryClassId)
      .order('created_at', { ascending: false }),
    shouldFetchDeployed
      ? supabase
          .from('lessons')
          .select('id, class_id, title, material_html')
          .in('class_id', classIds)
      : Promise.resolve({ data: null }),
  ]);

  const sortedMasters = sortLessonsByOrder((rawMasters || []) as Lesson[]);

  // 3. 기존 과목명 / 단원명 자동완성 목록 추출
  const subjectSet = new Set<string>();
  const unitSet = new Set<string>();
  for (const m of sortedMasters) {
    const parsed = parseLessonMaterial(m);
    if (parsed.subjectCategory?.trim()) {
      subjectSet.add(parsed.subjectCategory.trim());
    }
    if (parsed.unitCategory?.trim()) {
      unitSet.add(parsed.unitCategory.trim());
    }
  }

  // 4. 일반 학급에 배포된 레슨들 -> deployedMap 구성
  const deployedMap: Record<string, DeployedClassLink[]> = {};
  if (shouldFetchDeployed && classLessons) {
    const classNameMap = new Map(teacherClasses.map((c) => [c.id, c.name]));

    for (const cl of classLessons as Lesson[]) {
      const parsed = parseLessonMaterial(cl);
      const srcId = parsed.sourceMaterialId;
      if (srcId) {
        if (!deployedMap[srcId]) {
          deployedMap[srcId] = [];
        }
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

  const masterMaterials = lightweightMasterMaterials
    ? sortedMasters.map(toLightweightLessonForList)
    : sortedMasters;

  return {
    libraryClassId,
    masterMaterials,
    teacherClasses,
    deployedMap,
    existingSubjects: Array.from(subjectSet),
    existingUnits: Array.from(unitSet),
  };
}
