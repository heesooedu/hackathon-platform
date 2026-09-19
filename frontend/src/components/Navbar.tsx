import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { signOut } from '@/app/(auth)/actions';
import { Profile } from '@/types/database.types';

export default async function Navbar() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let profile: Profile | null = null;
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    profile = data as Profile | null;
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-100 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white font-extrabold text-lg shadow-sm">
            Q
          </span>
          <span className="text-xl font-bold tracking-tight text-gray-900">
            Q-Class
          </span>
        </Link>

        <nav className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">
                  {profile?.name || user.email?.split('@')[0]}
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    profile?.role === 'teacher'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {profile?.role === 'teacher' ? '👨‍🏫 선생님' : '🧑‍🎓 학생'}
                </span>
              </div>

              <form action={signOut}>
                <button
                  type="submit"
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 hover:text-gray-900"
                >
                  로그아웃
                </button>
              </form>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition hover:text-gray-900"
              >
                로그인
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                시작하기
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}

