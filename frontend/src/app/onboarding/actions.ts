'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { UserRole } from '@/types/database.types';

export async function saveRole(formData: FormData) {
  const role = formData.get('role') as UserRole;
  const name = formData.get('name') as string;

  if (!role || (role !== 'teacher' && role !== 'student')) {
    return { error: '역할을 올바르게 선택해 주세요.' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // 이미 역할이 부여된 계정이 임의로 역할을 변경(권한 상승)하는 것을 차단
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (existingProfile?.role === 'teacher' || existingProfile?.role === 'student') {
    redirect('/');
  }

  const updatePayload: { role: UserRole; name?: string } = { role };
  if (name && name.trim()) {
    updatePayload.name = name.trim();
  }

  const { error } = await supabase
    .from('profiles')
    .update(updatePayload)
    .eq('id', user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/', 'layout');
  redirect('/');
}

