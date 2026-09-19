'use client';

import { useState } from 'react';
import { createQuestionGroup } from '@/app/groups/actions';
import { Submission } from '@/types/database.types';

interface GroupQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  lessonId: string;
  classId: string;
  selectedSubmissions: Submission[];
  defaultTitle?: string;
  defaultContent?: string;
}

export default function GroupQuestionModal({
  isOpen,
  onClose,
  lessonId,
  classId,
  selectedSubmissions,
  defaultTitle = '',
  defaultContent = '',
}: GroupQuestionModalProps) {
  const [title, setTitle] = useState(defaultTitle);
  const [content, setContent] = useState(defaultContent);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    const formData = new FormData();
    formData.set('lesson_id', lessonId);
    formData.set('class_id', classId);
    formData.set('representative_title', title);
    formData.set('representative_content', content);
    formData.set(
      'submission_ids',
      JSON.stringify(selectedSubmissions.map((s) => s.id))
    );

    try {
      const res = await createQuestionGroup(formData);
      if (res?.error) {
        setErrorMessage(res.error);
        setLoading(false);
      } else {
        onClose();
      }
    } catch {
      setErrorMessage('대표 질문 생성에 실패했습니다.');
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl my-8">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              대표 질문 묶기 & 발행
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              선택한 {selectedSubmissions.length}개의 학생 질문을 하나로 묶어 대표 질문을 만듭니다.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        {errorMessage && (
          <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-600 border border-red-100">
            {errorMessage}
          </div>
        )}

        {/* 선택된 원본 질문 미리보기 (불변 보존 안내) */}
        <div className="mt-4 space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">
            묶일 원본 학생 질문들 (영구 보존됨)
          </label>
          <div className="max-h-36 overflow-y-auto rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-2 text-xs text-gray-700">
            {selectedSubmissions.map((s) => (
              <div key={s.id} className="border-b border-gray-200/60 pb-1.5 last:border-0 last:pb-0">
                <span className="font-semibold text-blue-600">
                  [{s.student?.name || '학생'}]:{' '}
                </span>
                <span>{s.content}</span>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="rep_title">
              대표 질문 제목 *
            </label>
            <input
              id="rep_title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: Q. 계수 a의 절댓값이 커지면 왜 포물선의 폭이 좁아질까요?"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="rep_content">
              대표 요약 설명 *
            </label>
            <textarea
              id="rep_content"
              required
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="예: 학생들이 a의 크기에 따른 y값 증가 속도를 헷갈려하고 있습니다. 각자 직관적인 이유나 그래프 비교 설명을 남겨주세요."
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim() || !content.trim()}
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '발행 중...' : '대표 질문 발행하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

