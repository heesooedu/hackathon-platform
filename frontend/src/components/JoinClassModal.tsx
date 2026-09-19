'use client';

import { useState } from 'react';
import { joinClass } from '@/app/classes/actions';

export default function JoinClassModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState('');

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    try {
      const result = await joinClass(formData);
      if (result?.error) {
        setErrorMessage(result.error);
        setLoading(false);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('NEXT_REDIRECT')) {
        return;
      }
      setErrorMessage('참여 중 문제가 발생했습니다.');
      setLoading(false);
    }
  }

  function handleCodeChange(e: React.ChangeEvent<HTMLInputElement>) {
    // 자동으로 대문자로 변환하고 최대 6자리까지만 허용
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setCode(value);
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
      >
        <span className="text-base font-bold">🔑</span>
        <span>참여 코드로 수업 등록</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">수업 참여 코드 입력</h2>
              <button
                onClick={() => {
                  setIsOpen(false);
                  setErrorMessage(null);
                  setCode('');
                }}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            {errorMessage && (
              <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-600 border border-red-100">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="join_code">
                  6자리 참여 코드
                </label>
                <input
                  id="join_code"
                  name="join_code"
                  type="text"
                  required
                  value={code}
                  onChange={handleCodeChange}
                  placeholder="예: AB3K9X"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3.5 text-center text-2xl font-mono font-bold tracking-widest text-gray-900 uppercase transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 placeholder:text-gray-300 placeholder:tracking-normal placeholder:font-sans placeholder:text-base"
                />
                <p className="mt-1.5 text-xs text-gray-400 text-center">
                  선생님께서 화면이나 칠판에 안내해 주신 6자리 코드를 입력하세요.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={loading || code.length !== 6}
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? '등록 중...' : '수업 등록하기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

