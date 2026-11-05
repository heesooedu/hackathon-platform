'use server';

import { randomInt } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { verifyClassTeacherAccess } from '@/utils/classTeacherAuth';
import type { Profile } from '@/types/database.types';

function generateJoinCode(): string {
  // 혼동하기 쉬운 문자(0, O, 1, I)를 제외한 읽기 쉬운 6자리 영숫자
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(randomInt(chars.length));
  }
  return result;
}

export async function createClass(formData: FormData) {
  const name = formData.get('name') as string;

  if (!name || !name.trim()) {
    return { error: '클래스 이름을 입력해 주세요.' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // 교사 역할 확인 (학생 계정의 클래스 개설 차단)
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'teacher') {
    return { error: '선생님 계정만 클래스를 개설할 수 있습니다.' };
  }

  // 중복되지 않는 코드 생성 시도 (최대 3회)
  let classId: string | null = null;
  let attempts = 0;

  while (!classId && attempts < 3) {
    attempts++;
    const joinCode = generateJoinCode();

    const { data, error } = await supabase
      .from('classes')
      .insert({
        name: name.trim(),
        join_code: joinCode,
        teacher_id: user.id,
      })
      .select('id')
      .single();

    if (!error && data) {
      classId = data.id;
    } else if (error && error.code !== '23505') { // unique violation 외의 에러
      return { error: '클래스 개설 중 오류가 발생했습니다: ' + error.message };
    }
  }

  if (!classId) {
    return { error: '참여 코드 생성에 실패했습니다. 다시 시도해 주세요.' };
  }

  revalidatePath('/', 'layout');
  redirect(`/classes/${classId}`);
}

export async function regenerateJoinCodeAction(
  classId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: '로그인이 필요합니다.' };
  }

  const access = await verifyClassTeacherAccess(supabase, classId, user.id);
  if (!access.classData || !access.isTeacher) {
    return { error: '담당 선생님만 참여 코드를 재발급할 수 있습니다.' };
  }

  if (access.classData.join_code?.startsWith('#')) {
    return { error: '교안 보관함에는 참여 코드를 사용할 수 없습니다.' };
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const { error } = await supabase
      .from('classes')
      .update({ join_code: generateJoinCode() })
      .eq('id', classId);

    if (!error) {
      revalidatePath(`/classes/${classId}`);
      revalidatePath('/');
      return {};
    }

    if (error.code !== '23505') {
      return { error: '참여 코드 재발급 중 오류가 발생했습니다.' };
    }
  }

  return { error: '참여 코드 생성에 실패했습니다. 다시 시도해 주세요.' };
}

export async function joinClass(formData: FormData) {
  const joinCode = formData.get('join_code') as string;

  if (!joinCode || !joinCode.trim()) {
    return { error: '6자리 참여 코드를 입력해 주세요.' };
  }

  const cleanCode = joinCode.trim().toUpperCase();
  if (cleanCode.length !== 6 || cleanCode.startsWith('#')) {
    return { error: '참여 코드는 6자리 영숫자입니다.' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data, error } = await supabase.rpc('join_class_by_code', {
    p_join_code: cleanCode,
  });

  if (error) {
    return { error: error.message };
  }

  const result = data as {
    success: boolean;
    message: string;
    class_id?: string;
    already_joined?: boolean;
  };

  if (!result.success) {
    return { error: result.message };
  }

  revalidatePath('/', 'layout');
  redirect(`/classes/${result.class_id}`);
}

export async function addStudentToClassAction(
  classId: string,
  identifier: string
): Promise<{ error?: string; studentName?: string }> {
  const cleanIdentifier = (identifier || '').trim();
  if (!cleanIdentifier) {
    return { error: '추가할 학생의 이메일을 입력해 주세요.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: '로그인이 필요합니다.' };
  }

  // 클래스 담당 교사(대표 교사 또는 팀티칭 교사) 확인
  const access = await verifyClassTeacherAccess(supabase, classId, user.id);

  if (!access.classData || !access.isTeacher) {
    return { error: '담당 선생님만 학생을 추가할 수 있습니다.' };
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    'teacher_add_student_to_class',
    {
      p_class_id: classId,
      p_identifier: cleanIdentifier,
    }
  );

  if (rpcError) {
    return { error: '학생 추가 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' };
  }

  const res = rpcData as {
    error?: string;
    success?: boolean;
    student_name?: string;
  };
  if (res.error) {
    return { error: res.error };
  }

  revalidatePath(`/classes/${classId}`);
  revalidatePath('/');
  return { studentName: res.student_name || cleanIdentifier };
}

export async function removeStudentFromClassAction(
  classId: string,
  studentId: string
): Promise<{ error?: string }> {
  if (!classId || !studentId) {
    return { error: '잘못된 요청입니다.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: '로그인이 필요합니다.' };
  }

  const access = await verifyClassTeacherAccess(supabase, classId, user.id);

  if (!access.classData || !access.isTeacher) {
    return { error: '담당 선생님만 학생을 제외할 수 있습니다.' };
  }

  // 1차: SECURITY DEFINER RPC 호출
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    'teacher_remove_student_from_class',
    {
      p_class_id: classId,
      p_student_id: studentId,
    }
  );

  if (!rpcError && rpcData) {
    const res = rpcData as { error?: string; success?: boolean };
    if (!res.error) {
      revalidatePath(`/classes/${classId}`);
      revalidatePath('/');
      return {};
    }
    if (access.isOwner) {
      return { error: res.error };
    }
  }

  // 2차 폴백: 일반 DELETE 쿼리 시도
  const { error: deleteError } = await supabase
    .from('class_members')
    .delete()
    .eq('class_id', classId)
    .eq('student_id', studentId);

  if (deleteError) {
    return {
      error: '학생 제외 중 오류가 발생했습니다: ' + deleteError.message,
    };
  }

  revalidatePath(`/classes/${classId}`);
  revalidatePath('/');
  return {};
}

/**
 * 클래스에 초대 가능한 동료 교사 목록을 조회합니다.
 * (08_privacy_and_rls_hardening.sql에 의해 role = 'teacher' 프로필은 인증된 사용자에게 공개됨)
 */
export async function getAvailableTeachersForInviteAction(
  classId: string
): Promise<{ teachers: Profile[]; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { teachers: [], error: '로그인이 필요합니다.' };
  }

  const access = await verifyClassTeacherAccess(supabase, classId, user.id);
  if (!access.classData || !access.isOwner) {
    return { teachers: [], error: '권한이 없습니다.' };
  }

  const { data: teacherRows, error } = await supabase
    .from('profiles')
    .select('id, name, role, avatar_url, created_at')
    .eq('role', 'teacher')
    .order('name', { ascending: true });

  if (error || !teacherRows) {
    return { teachers: [] };
  }

  const available = (teacherRows as Profile[]).filter(
    (t) => !access.allTeacherIds.has(t.id)
  );

  return { teachers: available };
}

/**
 * 다른 선생님을 팀티칭(공동 수업 교사)으로 클래스에 초대합니다.
 * identifier는 교사 ID(UUID), 이메일 주소, 또는 선생님 이름일 수 있습니다.
 */
export async function inviteCoTeacherAction(
  classId: string,
  identifier: string
): Promise<{ error?: string; teacherName?: string }> {
  const cleanIdentifier = (identifier || '').trim();
  if (!cleanIdentifier) {
    return { error: '초대할 선생님의 이메일 또는 성함을 입력해 주세요.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: '로그인이 필요합니다.' };
  }

  const access = await verifyClassTeacherAccess(supabase, classId, user.id);
  if (!access.classData || !access.isOwner) {
    return { error: '클래스 대표 교사만 공동 교사를 초대할 수 있습니다.' };
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    'teacher_invite_co_teacher',
    {
      p_class_id: classId,
      p_identifier: cleanIdentifier,
    }
  );

  if (rpcError) {
    return { error: '공동 교사 초대 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' };
  }

  const res = rpcData as {
    error?: string;
    success?: boolean;
    teacher_id?: string;
    teacher_name?: string;
  };
  if (res.error) {
    return { error: res.error };
  }

  revalidatePath(`/classes/${classId}`);
  revalidatePath('/materials');
  revalidatePath('/');
  return {
    teacherName: res.teacher_name || cleanIdentifier,
  };
}

/**
 * 클래스에서 공동 수업 교사(팀티칭 교사)를 해제하거나 본인이 팀티칭에서 나갑니다.
 */
export async function removeCoTeacherAction(
  classId: string,
  coTeacherId: string
): Promise<{ error?: string }> {
  if (!classId || !coTeacherId) {
    return { error: '잘못된 요청입니다.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: '로그인이 필요합니다.' };
  }

  const access = await verifyClassTeacherAccess(supabase, classId, user.id);
  if (!access.classData) {
    return { error: '클래스를 찾을 수 없습니다.' };
  }

  if (coTeacherId === access.classData.teacher_id) {
    return { error: '클래스 대표 개설 교사는 팀티칭에서 제외할 수 없습니다.' };
  }

  if (!access.isOwner && user.id !== coTeacherId) {
    return {
      error:
        '클래스 대표 교사 또는 본인만 팀티칭 참여를 해제할 수 있습니다.',
    };
  }

  // 1차: SECURITY DEFINER RPC 호출
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    'teacher_remove_co_teacher',
    {
      p_class_id: classId,
      p_teacher_id: coTeacherId,
    }
  );

  if (!rpcError && rpcData) {
    const res = rpcData as { error?: string; success?: boolean };
    if (res.error) {
      return { error: res.error };
    }
  }

  // 2차: class_teachers 및 class_members 폴백 정리
  await Promise.all([
    supabase
      .from('class_teachers')
      .delete()
      .eq('class_id', classId)
      .eq('teacher_id', coTeacherId),
    supabase
      .from('class_members')
      .delete()
      .eq('class_id', classId)
      .eq('student_id', coTeacherId),
  ]);

  revalidatePath(`/classes/${classId}`);
  revalidatePath('/materials');
  revalidatePath('/');
  return {};
}
