'use client';

import { useState } from 'react';
import { submitLearningStatus } from '@/app/submissions/actions';
import { Submission, SubmissionType } from '@/types/database.types';

interface StudentSubmissionFormProps {
  lessonId: string;
  classId: string;
  isClosed: boolean;
  existingSubmission: Submission | null;
}

const TYPE_CONFIG: Record<
  SubmissionType,
  { label: string; icon: string; desc: string; placeholder: string; color: string }
> = {
  question: {
    label: '궁금한 질문',
    icon: '❓',
    desc: '수업 내용 중 이해가 안 되거나 궁금한 점',
    placeholder: '예: 이차함수에서 a의 절댓값이 커질수록 왜 포물선의 폭이 좁아지나요?',
    color: 'border-blue-500 bg-blue-50/50 text-blue-700',
  },
  confusion: {
    label: '헷갈리는 지점',
    icon: '💭',
    desc: '설명이 어렵거나 혼란스러웠던 부분',
    placeholder: '예: 꼭짓점의 x좌표 공식이 왜 -b/2a인지 유도 과정이 헷갈려요.',
    color: 'border-amber-500 bg-amber-50/50 text-amber-700',
  },
  explore: {
    label: '더 알고 싶은 점',
    icon: '💡',
    desc: '추가로 탐구해보고 싶은 아이디어나 확장 질문',
    placeholder: '예: 실제 자동차 전조등이나 안테나에서도 이 포물선의 반사 원리가 쓰이나요?',
    color: 'border-purple-500 bg-purple-50/50 text-purple-700',
  },
  understood: {
    label: '이해 완료 확인',
    icon: '✅',
    desc: '핵심 개념을 나만의 언어로 정리하기',
    placeholder: '예: a의 부호는 볼록 방향, c는 y절편, 대칭축은 -b/2a라는 점을 확실히 이해했습니다!',
    color: 'border-emerald-500 bg-emerald-50/50 text-emerald-700',
  },
};

export default function StudentSubmissionForm({
  lessonId,
  classId,
  isClosed,
  existingSubmission,
}: StudentSubmissionFormProps) {
  const [selectedType, setSelectedType] = useState<SubmissionType>(
    existingSubmission?.type || 'question'
  );
  const [content, setContent] = useState(existingSubmission?.content || '');
  const [isEditing, setIsEditing] = useState(!existingSubmission);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isClosed) return;

    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const formData = new FormData();
    formData.set('lesson_id', lessonId);
    formData.set('class_id', classId);
    formData.set('type', selectedType);
    formData.set('content', content);

    try {
      const res = await submitLearningStatus(formData);
      if (res?.error) {
        setErrorMessage(res.error);
      } else {
        setSuccessMessage('성공적으로 제출되었습니다!');
        setIsEditing(false);
      }
    } catch {
      setErrorMessage('제출 중 문제가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      {/* 상단 헤더 */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900">내 질문 & 이해 상태</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            무리해서 질문을 쥐어짜지 않아도 됩니다. 4가지 중 솔직한 현재 상태를 제출해 주세요.
          </p>
        </div>

        {existingSubmission && !isEditing && !isClosed && (
          <button
            onClick={() => setIsEditing(true)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
          >
            ✏️ 내용 수정하기
          </button>
        )}
      </div>

      {successMessage && (
        <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="mb-4 rounded-xl bg-red-50 border border-red-100 p-3 text-sm text-red-600">
          {errorMessage}
        </div>
      )}

      {/* 이미 제출했고 수정 모드가 아닐 때의 읽기 카드 */}
      {!isEditing && existingSubmission ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                TYPE_CONFIG[existingSubmission.type].color
              }`}
            >
              <span>{TYPE_CONFIG[existingSubmission.type].icon}</span>
              <span>{TYPE_CONFIG[existingSubmission.type].label}</span>
            </span>
            <span className="text-xs text-gray-400">
              최종 제출:{' '}
              {new Date(existingSubmission.updated_at).toLocaleString('ko-KR', {
                month: 'numeric',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>

          <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-800 leading-relaxed border border-gray-100">
            {existingSubmission.content}
          </div>

          <div className="text-xs text-gray-400 flex items-center justify-between pt-2">
            <span>🔒 동료 학생들에게는 기본 익명으로 안전하게 공유됩니다.</span>
            {isClosed && (
              <span className="font-semibold text-amber-600">
                마감되어 더 이상 수정할 수 없습니다.
              </span>
            )}
          </div>
        </div>
      ) : (
        /* 작성 / 수정 폼 */
        <form onSubmit={handleSubmit} className="space-y-6">
          {isClosed ? (
            <div className="rounded-xl bg-gray-50 p-6 text-center text-sm text-gray-500">
              ⛔ 이 레슨은 질문 접수가 마감되었습니다.
            </div>
          ) : (
            <>
              {/* 4가지 유형 선택 카드 그리드 */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                  제출 유형 선택 (1가지 선택)
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(Object.keys(TYPE_CONFIG) as SubmissionType[]).map((t) => {
                    const cfg = TYPE_CONFIG[t];
                    const isSelected = selectedType === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setSelectedType(t)}
                        className={`flex flex-col text-left p-3.5 rounded-xl border-2 transition ${
                          isSelected
                            ? cfg.color + ' shadow-sm'
                            : 'border-gray-100 bg-white hover:border-gray-200 text-gray-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 font-bold text-sm">
                          <span>{cfg.icon}</span>
                          <span>{cfg.label}</span>
                        </div>
                        <span className="mt-1 text-xs text-gray-500 line-clamp-1">
                          {cfg.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 내용 입력 텍스트에어리어 */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                  내용 작성
                </label>
                <textarea
                  rows={4}
                  required
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={TYPE_CONFIG[selectedType].placeholder}
                  className="w-full rounded-xl border border-gray-200 p-4 text-sm text-gray-900 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
                <div className="mt-1 flex justify-between text-xs text-gray-400">
                  <span>솔직하게 적어주시면 다음 수업 개선에 큰 도움이 됩니다.</span>
                  <span>{content.length}자</span>
                </div>
              </div>

              {/* 하단 액션 버튼 */}
              <div className="flex items-center justify-end gap-2 pt-2">
                {existingSubmission && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setContent(existingSubmission.content);
                      setSelectedType(existingSubmission.type);
                    }}
                    className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-500 hover:bg-gray-100"
                  >
                    취소
                  </button>
                )}
                <button
                  type="submit"
                  disabled={loading || !content.trim()}
                  className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading
                    ? '저장 중...'
                    : existingSubmission
                    ? '수정 완료하기'
                    : '제출하기'}
                </button>
              </div>
            </>
          )}
        </form>
      )}
    </div>
  );
}
