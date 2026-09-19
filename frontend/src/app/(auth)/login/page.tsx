'use client';

import { useState } from 'react';
import Link from 'next/link';
import { login } from '../actions';

export default function LoginPage() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    try {
      const result = await login(formData);
      if (result?.error) {
        setErrorMessage(result.error);
        setLoading(false);
      }
    } catch (err: unknown) {
      // redirect() throws a NEXT_REDIRECT error in Server Actions, which is normal
      if (err instanceof Error && err.message.includes('NEXT_REDIRECT')) {
        return;
      }
      setErrorMessage('로그인 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.');
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-8 shadow-xl">
        <div className="mb-8 text-center">
          <div className="mb-2 text-3xl font-extrabold text-blue-600">Q-Class</div>
          <h1 className="text-2xl font-bold text-gray-900">로그인</h1>
          <p className="mt-2 text-sm text-gray-500">
            질문 중심 학습 플랫폼에 오신 것을 환영합니다.
          </p>
        </div>

        {errorMessage && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-600 border border-red-100">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="email">
              이메일 주소
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="example@school.edu"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="password">
              비밀번호
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              placeholder="••••••••"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-500">
          계정이 아직 없으신가요?{' '}
          <Link href="/signup" className="font-semibold text-blue-600 hover:underline">
            회원가입
          </Link>
        </div>
      </div>
    </div>
  );
}
