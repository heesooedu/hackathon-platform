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

