'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signup } from '../actions';
import { UserRole } from '@/types/database.types';

export default function SignupPage() {
  const [role, setRole] = useState<UserRole>('student');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    formData.set('role', role);

    try {
      const result = await signup(formData);
      if (result?.error) {
        setErrorMessage(result.error);
        setLoading(false);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('NEXT_REDIRECT')) {
        return;
      }
      setErrorMessage('회원가입 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-8 shadow-xl">
        <div className="mb-6 text-center">
          <div className="mb-2 text-3xl font-extrabold text-blue-600">Q-Class</div>
          <h1 className="text-2xl font-bold text-gray-900">회원가입</h1>
          <p className="mt-2 text-sm text-gray-500">
            시작하기 위해 가입 유형을 선택해 주세요.
          </p>
        </div>

        {errorMessage && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-600 border border-red-100">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 역할 선택 카드 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              가입 유형
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole('student')}
                className={`flex flex-col items-center justify-center rounded-xl border p-4 text-center transition ${
                  role === 'student'
                    ? 'border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-500'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className="text-2xl mb-1">🧑‍🎓</span>
                <span className="text-sm font-bold">학생</span>
                <span className="text-xs text-gray-400 mt-0.5">질문 및 동료 답변</span>
              </button>

              <button
                type="button"
                onClick={() => setRole('teacher')}
                className={`flex flex-col items-center justify-center rounded-xl border p-4 text-center transition ${
                  role === 'teacher'
                    ? 'border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-500'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className="text-2xl mb-1">👨‍🏫</span>
                <span className="text-sm font-bold">선생님</span>
                <span className="text-xs text-gray-400 mt-0.5">수업 및 질문 관리</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="name">
              이름 (실명)
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              placeholder={role === 'teacher' ? '김선생' : '이학생'}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="email">
              이메일 주소
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="user@school.edu"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="password">
              비밀번호 (6자 이상)
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              placeholder="••••••••"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '가입 처리 중...' : `${role === 'teacher' ? '선생님' : '학생'}으로 회원가입`}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-500">
          이미 계정이 있으신가요?{' '}
          <Link href="/login" className="font-semibold text-blue-600 hover:underline">
            로그인
          </Link>
        </div>
      </div>
    </div>
  );
}
