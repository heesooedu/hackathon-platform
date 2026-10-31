import type { SupabaseClient } from '@supabase/supabase-js';
import type { ClassItem, Profile } from '@/types/database.types';

export interface ClassTeacherAccessResult {
  classData: {
    id: string;
    name: string;
    join_code: string;
    teacher_id: string;
    created_at: string;
    teacher?: Profile;
  } | null;
  isTeacher: boolean;
  isOwner: boolean;
  isCoTeacher: boolean;
  coTeachers: Profile[];
  allTeacherIds: Set<string>;
}

function normalizeProfile(raw: unknown): Profile | null {
  if (!raw) return null;
  const obj = Array.isArray(raw) ? raw[0] : raw;
  if (!obj || typeof obj !== 'object') return null;
  const record = obj as Record<string, unknown>;
  if (typeof record.id !== 'string') return null;
  return {
    id: record.id,
    name: typeof record.name === 'string' && record.name.trim() ? record.name : '선생님',
    role: record.role === 'teacher' || record.role === 'student' ? record.role : null,
    avatar_url: typeof record.avatar_url === 'string' ? record.avatar_url : null,
    created_at: typeof record.created_at === 'string' ? record.created_at : new Date().toISOString(),
  };
}

/**
 * 클래스의 대표 교사(Owner) 및 공동 교사(Co-Teacher / 팀티칭) 여부를 확인하고
 * 해당 클래스의 모든 공동 교사 목록을 반환합니다.
 * DB 마이그레이션(10_team_teaching.sql) 전후 모두 호환되도록 class_teachers 및 class_members 폴백을 함께 확인합니다.
 */
export async function verifyClassTeacherAccess(
  supabase: SupabaseClient,
  classId: string,
  userId: string
): Promise<ClassTeacherAccessResult> {
  const { data: rawClass } = await supabase
    .from('classes')
    .select('id, name, join_code, teacher_id, created_at, teacher:profiles!classes_teacher_id_fkey(id, name, role, avatar_url, created_at)')
    .eq('id', classId)
    .single();

  if (!rawClass) {
    return {
      classData: null,
      isTeacher: false,
      isOwner: false,
      isCoTeacher: false,
      coTeachers: [],
      allTeacherIds: new Set<string>(),
    };
  }

  const primaryTeacher = normalizeProfile((rawClass as Record<string, unknown>).teacher) || undefined;
  const classData = {
    id: rawClass.id as string,
    name: rawClass.name as string,
    join_code: rawClass.join_code as string,
    teacher_id: rawClass.teacher_id as string,
    created_at: rawClass.created_at as string,
    teacher: primaryTeacher,
  };

  const coTeacherMap = new Map<string, Profile>();

  // 1) class_teachers 테이블 조회 (10_team_teaching.sql 적용 시)
  const { data: ctRows, error: ctError } = await supabase
    .from('class_teachers')
    .select('teacher_id, created_at, teacher:profiles!class_teachers_teacher_id_fkey(id, name, role, avatar_url, created_at)')
    .eq('class_id', classId)
    .order('created_at', { ascending: true });

  if (!ctError && ctRows) {
    for (const row of ctRows as Record<string, unknown>[]) {
      const tid = row.teacher_id as string;
      if (!tid || tid === classData.teacher_id) continue;
      const prof = normalizeProfile(row.teacher) || {
        id: tid,
        name: '공동 교사',
        role: 'teacher',
        avatar_url: null,
        created_at: (row.created_at as string) || new Date().toISOString(),
      };
      coTeacherMap.set(tid, prof);
    }
  }

  // 2) 폴백: class_members에 등록된 계정 중 role === 'teacher'인 경우 공동 교사로 인식
  const { data: memberTeacherRows } = await supabase
    .from('class_members')
    .select('student_id, joined_at, student:profiles!class_members_student_id_fkey(id, name, role, avatar_url, created_at)')
    .eq('class_id', classId);

  if (memberTeacherRows) {
    for (const row of memberTeacherRows as Record<string, unknown>[]) {
      const prof = normalizeProfile(row.student);
      if (prof && prof.role === 'teacher' && prof.id !== classData.teacher_id) {
        if (!coTeacherMap.has(prof.id)) {
          coTeacherMap.set(prof.id, prof);
        }
      }
    }
  }

  const coTeachers = Array.from(coTeacherMap.values());
  const allTeacherIds = new Set<string>([classData.teacher_id, ...coTeachers.map((t) => t.id)]);
  const isOwner = classData.teacher_id === userId;
  const isCoTeacher = !isOwner && coTeacherMap.has(userId);
  const isTeacher = isOwner || isCoTeacher;

  return {
    classData,
    isTeacher,
    isOwner,
    isCoTeacher,
    coTeachers,
    allTeacherIds,
  };
}

/**
 * 교사가 담당하는 모든 클래스(본인이 개설한 대표 클래스 + 팀티칭으로 참여 중인 공동 수업 클래스)를 조회합니다.
 */
export async function fetchTeacherAccessibleClasses(
  supabase: SupabaseClient,
  teacherId: string
): Promise<ClassItem[]> {
  // 1) 대표 개설 클래스 ID 및 팀티칭 참여 클래스 ID 수집
  const [{ data: ownedRows }, { data: coTaughtRows, error: ctErr }, { data: memberFallbackRows }] =
    await Promise.all([
      supabase.from('classes').select('id').eq('teacher_id', teacherId),
      supabase.from('class_teachers').select('class_id').eq('teacher_id', teacherId),
      supabase.from('class_members').select('class_id').eq('student_id', teacherId),
    ]);

  const classIdSet = new Set<string>();
  for (const r of ownedRows || []) {
    if (r.id) classIdSet.add(r.id);
  }
  if (!ctErr && coTaughtRows) {
    for (const r of coTaughtRows) {
      if (r.class_id) classIdSet.add(r.class_id);
    }
  }
  for (const r of memberFallbackRows || []) {
    if (r.class_id) classIdSet.add(r.class_id);
  }

  const allClassIds = Array.from(classIdSet);
  if (allClassIds.length === 0) return [];

  // 2) 클래스 상세 + 대표 교사 프로필 + 멤버 목록 조회
  const { data: rawClasses } = await supabase
    .from('classes')
    .select(
      '*, teacher:profiles!classes_teacher_id_fkey(id, name, role, avatar_url, created_at), class_members(student_id, student:profiles!class_members_student_id_fkey(id, name, role, avatar_url, created_at))'
    )
    .in('id', allClassIds)
    .order('created_at', { ascending: false });

  if (!rawClasses || rawClasses.length === 0) return [];

  // 3) 모든 대상 클래스의 class_teachers 목록 일괄 조회
  const { data: allCtRows, error: allCtErr } = await supabase
    .from('class_teachers')
    .select('class_id, teacher_id, created_at, teacher:profiles!class_teachers_teacher_id_fkey(id, name, role, avatar_url, created_at)')
    .in('class_id', allClassIds)
    .order('created_at', { ascending: true });

  const coTeachersByClass = new Map<string, Map<string, Profile>>();
  if (!allCtErr && allCtRows) {
    for (const row of allCtRows as Record<string, unknown>[]) {
      const cid = row.class_id as string;
      const tid = row.teacher_id as string;
      if (!cid || !tid) continue;
      if (!coTeachersByClass.has(cid)) {
        coTeachersByClass.set(cid, new Map());
      }
      const prof = normalizeProfile(row.teacher) || {
        id: tid,
        name: '공동 교사',
        role: 'teacher',
        avatar_url: null,
        created_at: (row.created_at as string) || new Date().toISOString(),
      };
      coTeachersByClass.get(cid)!.set(tid, prof);
    }
  }

  return (rawClasses as Record<string, unknown>[]).map((c) => {
    const cid = c.id as string;
    const ownerId = c.teacher_id as string;
    const primaryTeacher = normalizeProfile(c.teacher) || undefined;
    const ctMap = coTeachersByClass.get(cid) ?? new Map<string, Profile>();

    const rawMembers = Array.isArray(c.class_members)
      ? (c.class_members as Record<string, unknown>[])
      : [];

    let studentCount = 0;
    for (const m of rawMembers) {
      const studentProf = normalizeProfile(m.student);
      const sid = (m.student_id as string) || studentProf?.id;
      if (!sid) continue;
      if (sid === ownerId) continue;
      if (studentProf?.role === 'teacher') {
        if (!ctMap.has(sid)) {
          ctMap.set(sid, studentProf);
        }
        continue;
      }
      if (ctMap.has(sid)) continue;
      studentCount += 1;
    }

    // 대표 교사는 공동 교사 배열에서 제외
    ctMap.delete(ownerId);
    const coTeachers = Array.from(ctMap.values());

    return {
      id: cid,
      teacher_id: ownerId,
      name: c.name as string,
      join_code: c.join_code as string,
      created_at: c.created_at as string,
      teacher: primaryTeacher,
      co_teachers: coTeachers,
      is_co_teaching: coTeachers.length > 0,
      my_class_role: ownerId === teacherId ? 'owner' : 'co_teacher',
      member_count: studentCount,
    };
  });
}
