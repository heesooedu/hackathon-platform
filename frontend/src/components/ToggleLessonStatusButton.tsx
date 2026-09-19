'use client';

import { useState } from 'react';
import { toggleLessonStatus } from '@/app/lessons/actions';
import { LessonStatus } from '@/types/database.types';

interface ToggleLessonStatusButtonProps {
  lessonId: string;
  classId: string;
  initialStatus: LessonStatus;
}

export default function ToggleLessonStatusButton({
  lessonId,
  classId,
  initialStatus,
}: ToggleLessonStatusButtonProps) {
  const [status, setStatus] = useState<LessonStatus>(initialStatus);
  const [loading, setLoading] = useState(false);

  async function handleToggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    try {
      setLoading(true);
      const res = await toggleLessonStatus(lessonId, classId, status);
      if (res?.success && res.newStatus) {
        setStatus(res.newStatus as LessonStatus);
      }
    } catch (err) {
      console.error(err);
      alert('상태 변경에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
        status === 'open'
          ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
      } disabled:opacity-50`}
    >
      {loading ? '처리 중...' : status === 'open' ? '마감하기' : '다시 열기'}
    </button>
  );
}

