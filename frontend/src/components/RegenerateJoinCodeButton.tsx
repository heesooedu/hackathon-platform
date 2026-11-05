'use client';

import { useState, useTransition } from 'react';
import { regenerateJoinCodeAction } from '@/app/classes/actions';

export default function RegenerateJoinCodeButton({ classId }: { classId: string }) {
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function handleClick() {
    const confirmed = window.confirm(
      '참여 코드를 새로 만들까요?\n기존 코드는 바로 사용할 수 없게 됩니다. 이미 참여한 학생은 그대로 유지됩니다.'
    );
    if (!confirmed) return;

    setErrorMsg(null);
    startTransition(async () => {
      const res = await regenerateJoinCodeAction(classId);
      if (res.error) setErrorMsg(res.error);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 active:scale-95 disabled:opacity-50"
      >
        {isPending ? '변경 중...' : '🔄 재발급'}
      </button>
      {errorMsg && (
        <span role="alert" className="text-xs font-semibold text-rose-600">
          {errorMsg}
        </span>
      )}
    </>
  );
}
