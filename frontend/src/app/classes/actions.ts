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
  if (cleanCode.length !== 6) {
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
