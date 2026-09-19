'use client';

import { useState } from 'react';
import {
  toggleGroupResolved,
  createAnswer,
  toggleAnswerChecked,
} from '@/app/groups/actions';
import { QuestionGroup, Answer } from '@/types/database.types';

interface RepresentativeQuestionSectionProps {
  groups: QuestionGroup[];
  classId: string;
  lessonId: string;
  isTeacher: boolean;
  currentUserId: string;
}

export default function RepresentativeQuestionSection({
  groups,
  classId,
  lessonId,
  isTeacher,
  currentUserId,
}: RepresentativeQuestionSectionProps) {
  const [openSubmissions, setOpenSubmissions] = useState<Record<string, boolean>>({});
  const [answeringGroupId, setAnsweringGroupId] = useState<string | null>(null);
  const [answerContent, setAnswerContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function toggleOpenSubmissions(groupId: string) {
    setOpenSubmissions((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  }

  async function handleToggleResolved(groupId: string, currentStatus: boolean) {
    await toggleGroupResolved(groupId, classId, lessonId, currentStatus);
  }

  async function handleToggleChecked(answerId: string, currentChecked: boolean) {
    await toggleAnswerChecked(answerId, classId, lessonId, currentChecked);
  }

  async function handleAnswerSubmit(groupId: string) {
    if (!answerContent.trim()) return;
    setSubmitting(true);

    const formData = new FormData();
    formData.set('group_id', groupId);
    formData.set('class_id', classId);
    formData.set('lesson_id', lessonId);
    formData.set('content', answerContent);

    try {
      await createAnswer(formData);
      setAnswerContent('');
      setAnsweringGroupId(null);
    } finally {
      setSubmitting(false);
    }
  }

  if (groups.length === 0) {
    return null; // 아직 대표 질문이 없으면 렌더링하지 않음
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-gray-200 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl font-extrabold text-blue-700">⭐ 우리 반 대표 질문</span>
          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-800">
            {groups.length}개 발행됨
          </span>
        </div>
        <p className="text-xs text-gray-500 hidden sm:block">
          유사한 질문들이 대표 질문으로 묶였습니다. 동료와 함께 생각을 나누어보세요.
        </p>
      </div>

      <div className="space-y-6">
        {groups.map((group) => {
          const members = group.members || [];
          const answers = group.answers || [];
          const isResolved = group.is_resolved;

          return (
            <div
              key={group.id}
              className={`rounded-2xl border-2 transition p-6 shadow-sm ${
                isResolved
                  ? 'border-emerald-200 bg-emerald-50/20'
                  : 'border-blue-200 bg-white'
              }`}
            >
              {/* 상단 상태 뱃지 & 액션 */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
                      isResolved
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {isResolved ? '🎉 해결 완료' : '💬 탐구 & 답변 진행 중'}
                  </span>

                  <span className="text-xs font-semibold text-gray-400">
                    묶인 원본 질문 {members.length}건
                  </span>
                </div>

                {isTeacher && (
                  <button
                    onClick={() => handleToggleResolved(group.id, isResolved)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                      isResolved
                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                    }`}
                  >
                    {isResolved ? '해결 취소' : '✓ 질문 해결 완료 처리'}
                  </button>
                )}
              </div>

              {/* 대표 질문 제목 및 요약 */}
              <h3 className="text-xl font-bold text-gray-900 leading-snug">
                {group.representative_title}
              </h3>
              <p className="mt-2 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {group.representative_content}
              </p>

              {/* 묶인 원본 학생 질문 아코디언 (불변성 시각화) */}
              {members.length > 0 && (
                <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50/80 p-3">
                  <button
                    type="button"
                    onClick={() => toggleOpenSubmissions(group.id)}
                    className="flex w-full items-center justify-between text-left text-xs font-bold text-gray-600"
                  >
                    <span>
                      📎 묶인 학생 원본 질문 {members.length}건 확인하기 (영구 보존됨)
                    </span>
                    <span>{openSubmissions[group.id] ? '▲ 접기' : '▼ 펼치기'}</span>
                  </button>

                  {openSubmissions[group.id] && (
                    <div className="mt-3 space-y-2 border-t border-gray-200/60 pt-2 text-xs text-gray-600">
                      {members.map((m) => (
                        <div key={m.id} className="flex items-start gap-1.5">
                          <span className="text-blue-500 font-bold">•</span>
                          <span>{m.submission?.content}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 동료 답변 스레드 영역 */}
              <div className="mt-6 border-t border-gray-100 pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                    <span>💡 동료 답변</span>
                    <span className="text-xs text-blue-600 font-extrabold">
                      ({answers.length})
                    </span>
                  </h4>

                  {!answeringGroupId && (
                    <button
                      onClick={() => setAnsweringGroupId(group.id)}
                      className="rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition"
                    >
                      + 내 생각/답변 달기
                    </button>
                  )}
                </div>

                {/* 답변 작성 폼 */}
                {answeringGroupId === group.id && (
                  <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-4 space-y-3">
                    <label className="block text-xs font-bold text-gray-700">
                      내 답변 작성하기
                    </label>
                    <textarea
                      rows={3}
                      value={answerContent}
                      onChange={(e) => setAnswerContent(e.target.value)}
                      placeholder="친구들의 이해를 도울 수 있는 나만의 직관적인 설명이나 문제 해결 과정을 적어주세요."
                      className="w-full rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setAnsweringGroupId(null);
                          setAnswerContent('');
                        }}
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-100"
                      >
                        취소
                      </button>
                      <button
                        disabled={submitting || !answerContent.trim()}
                        onClick={() => handleAnswerSubmit(group.id)}
                        className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {submitting ? '등록 중...' : '답변 등록'}
                      </button>
                    </div>
                  </div>
                )}

                {/* 답변 목록 */}
                {answers.length > 0 ? (
                  <div className="space-y-2.5">
                    {answers.map((ans) => {
                      const authorName = isTeacher
                        ? ans.author?.name || '익명 학생'
                        : ans.author_id === currentUserId
                        ? '나의 답변'
                        : '동료 학생';

                      return (
                        <div
                          key={ans.id}
                          className={`rounded-xl border p-4 transition ${
                            ans.is_teacher_checked
                              ? 'border-emerald-200 bg-emerald-50/40'
                              : 'border-gray-100 bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-gray-900">
                                {authorName}
                              </span>
                              {ans.is_teacher_checked && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-300 px-2 py-0.5 text-[11px] font-extrabold text-emerald-800">
                                  <span>✓</span>
                                  <span>선생님 검증 완료</span>
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-gray-400">
                                {new Date(ans.created_at).toLocaleDateString('ko-KR', {
                                  month: 'numeric',
                                  day: 'numeric',
                                })}
                              </span>

                              {isTeacher && (
                                <button
                                  onClick={() =>
                                    handleToggleChecked(ans.id, ans.is_teacher_checked)
                                  }
                                  className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                                    ans.is_teacher_checked
                                      ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                                  }`}
                                >
                                  {ans.is_teacher_checked
                                    ? '검증 취소'
                                    : '선생님 확인 도장 찍기'}
                                </button>
                              )}
                            </div>
                          </div>

                          <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                            {ans.content}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-4 text-center text-xs text-gray-400">
                    아직 등록된 동료 답변이 없습니다. 첫 번째 답변을 작성해 보세요!
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
