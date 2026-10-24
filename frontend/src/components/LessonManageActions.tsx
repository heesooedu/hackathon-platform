'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { deleteLessonAction } from '@/app/lessons/actions';

interface LessonManageActionsProps {
  lessonId: string;
  classId: string;
  lessonTitle: string;
  redirectAfterDelete?: boolean;
  compact?: boolean;
}

export default function LessonManageActions({
  lessonId,
  classId,
  lessonTitle,
  redirectAfterDelete = false,
  compact = false,
}: LessonManageActionsProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    const confirmed = window.confirm(
      `정말 "${lessonTitle}" 레슨과 수업 교안을 삭제하시겠습니까?\n(이 레슨에 제출된 학생 질문과 답변도 함께 삭제되며 복구할 수 없습니다.)`
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      const res = await deleteLessonAction(lessonId, classId);
      if (!res.success) {
        alert(res.error || '레슨 삭제에 실패했습니다.');
        setDeleting(false);
        return;
      }

      if (redirectAfterDelete) {
        router.push(`/classes/${classId}`);
      }
      router.refresh();
    } catch {
      alert('레슨 삭제 중 오류가 발생했습니다.');
      setDeleting(false);
    }
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <Link
        href={`/classes/${classId}/lessons/${lessonId}/edit`}
        className={`inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white font-bold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition ${
          compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-xs'
        }`}
        title="노션 스튜디오에서 레슨 제목·학습목표·교안 수정"
      >
        <span>✏️</span>
        <span>{compact ? '교안·레슨 수정' : '교안·레슨 전체 수정'}</span>
      </Link>

      <button
        type="button"
        disabled={deleting}
        onClick={handleDelete}
        className={`inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50/70 font-bold text-red-600 hover:bg-red-100 hover:border-red-300 disabled:opacity-50 transition ${
          compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-xs'
        }`}
        title="이 레슨 및 수업 교안 삭제"
      >
        <span>🗑️</span>
        <span>{deleting ? '삭제 중...' : '삭제'}</span>
      </button>
    </div>
  );
}
