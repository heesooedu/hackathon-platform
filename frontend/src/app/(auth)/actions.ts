'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { UserRole } from '@/types/database.types';

export async function login(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { error: '이메일과 비밀번호를 모두 입력해 주세요.' };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message === 'Invalid login credentials' 
      ? '이메일 또는 비밀번호가 일치하지 않습니다.' 
      : error.message };
  }

  revalidatePath('/', 'layout');
  redirect('/');
}

export async function signup(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const name = formData.get('name') as string;
  const role = (formData.get('role') as UserRole) || 'student';

  if (!email || !password || !name) {
    return { error: '모든 필수 항목을 입력해 주세요.' };
  }

  if (password.length < 6) {
    return { error: '비밀번호는 최소 6자 이상이어야 합니다.' };
  }

  if (role !== 'teacher' && role !== 'student') {
    return { error: '유효한 역할을 선택해 주세요.' };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        role,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/', 'layout');
  redirect('/');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/');
}

