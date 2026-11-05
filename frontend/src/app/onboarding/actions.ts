'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { UserRole } from '@/types/database.types';

export async function saveRole(formData: FormData) {
  const role = formData.get('role') as UserRole;
  const name = formData.get('name') as string;
  const teacherCode = ((formData.get('teacher_code') as string) || '').trim();

  if (!role || (role !== 'teacher' && role !== 'student')) {
    return { error: '역할을 올바르게 선택해 주세요.' };
  }

  if (role === 'teacher' && !teacherCode) {
    return { error: '교사 인증 코드를 입력해 주세요.' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (existingProfile?.role === 'teacher' || existingProfile?.role === 'student') {
    redirect('/');
  }

  // 역할은 DB 함수에서만 부여합니다. 교사 코드 검증도 이 함수 안에서 이뤄집니다.
  const { data, error } =
    role === 'teacher'
      ? await supabase.rpc('claim_teacher_role', { p_code: teacherCode })
      : await supabase.rpc('choose_student_role');

  if (error) {
    return { error: '역할 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' };
  }

  const result = data as { success: boolean; message?: string };
  if (!result.success) {
    return { error: result.message || '역할을 저장하지 못했습니다.' };
  }

  if (name && name.trim()) {
    await supabase
      .from('profiles')
      .update({ name: name.trim() })
      .eq('id', user.id);
  }

  revalidatePath('/', 'layout');
  redirect('/');
}
