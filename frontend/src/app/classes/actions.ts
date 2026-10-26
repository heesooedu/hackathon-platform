'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';

function generateJoinCode(): string {
  // 혼동하기 쉬운 문자(0, O, 1, I)를 제외한 읽기 쉬운 6자리 영숫자
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
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
    return { error: '추가할 학생의 이메일 또는 이름을 입력해 주세요.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: '로그인이 필요합니다.' };
  }

  // 클래스 소유 교사 확인
  const { data: classData } = await supabase
    .from('classes')
    .select('id, teacher_id, join_code')
    .eq('id', classId)
    .single();

  if (!classData || classData.teacher_id !== user.id) {
    return { error: '담당 선생님만 학생을 추가할 수 있습니다.' };
  }

  // 1차: SECURITY DEFINER RPC 함수 호출
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    'teacher_add_student_to_class',
    {
      p_class_id: classId,
      p_identifier: cleanIdentifier,
    }
  );

  if (!rpcError && rpcData) {
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

  // 2차 폴백: 마이그레이션(09_teacher_student_management.sql) 적용 전 환경 호환
  const { data: matchedProfiles } = await supabase
    .from('profiles')
    .select('id, name, role')
    .eq('role', 'student')
    .ilike('name', cleanIdentifier);

  if (!matchedProfiles || matchedProfiles.length === 0) {
    return {
      error:
        '일치하는 학생 계정을 찾을 수 없습니다. (신규 학생 이메일/이름 검색을 위해선 Supabase SQL Editor에서 09_teacher_student_management.sql을 실행하거나, 학생에게 6자리 참여 코드 [' +
        classData.join_code +
        ']를 안내해 주세요.)',
    };
  }

  if (matchedProfiles.length > 1) {
    return {
      error:
        '동명이인 학생이 여러 명 있습니다. 이메일 주소로 정확히 추가해 주세요.',
    };
  }

  const targetStudent = matchedProfiles[0];

  const { error: insertError } = await supabase.from('class_members').insert({
    class_id: classId,
    student_id: targetStudent.id,
  });

  if (insertError) {
    if (insertError.code === '23505') {
      return { error: '이미 이 클래스에 등록되어 있는 학생입니다.' };
    }
    return {
      error:
        '학생 추가 권한 정책(09_teacher_student_management.sql) 적용이 필요합니다: ' +
        insertError.message,
    };
  }

  revalidatePath(`/classes/${classId}`);
  revalidatePath('/');
  return { studentName: targetStudent.name || cleanIdentifier };
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

  const { data: classData } = await supabase
    .from('classes')
    .select('id, teacher_id')
    .eq('id', classId)
    .single();

  if (!classData || classData.teacher_id !== user.id) {
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
    if (res.error) {
      return { error: res.error };
    }
    revalidatePath(`/classes/${classId}`);
    revalidatePath('/');
    return {};
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


