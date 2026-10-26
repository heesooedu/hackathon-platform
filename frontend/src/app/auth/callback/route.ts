import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const rawNext = searchParams.get('next') ?? '/';
  // 오픈 리다이렉트(Open Redirect) 방지: 반드시 단일 '/'로 시작하는 내부 경로만 허용
  const next =
    rawNext.startsWith('/') && !rawNext.startsWith('//') && !rawNext.startsWith('/\\')
      ? rawNext
      : '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // 사용자 프로필 및 역할 확인
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        // 역할(선생님/학생)이 아직 지정되지 않았다면 온보딩으로 이동
        if (!profile || !profile.role) {
          return NextResponse.redirect(`${origin}/onboarding`);
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // 오류 시 로그인 화면으로 리다이렉트
  return NextResponse.redirect(`${origin}/login?error=auth_error`);
}

