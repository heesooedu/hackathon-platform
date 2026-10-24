'use client';

import { useState } from 'react';
import { FormativeQuiz } from '@/types/database.types';
import { submitQuizAnswerAction } from '@/app/lessons/actions';

interface StudentFormativeQuizSectionProps {
  lessonId: string;
  classId: string;
  currentUserId: string;
  quizzes: FormativeQuiz[];
}

export default function StudentFormativeQuizSection({
  lessonId,
  classId,
  currentUserId,
  quizzes,
}: StudentFormativeQuizSectionProps) {
  // 각 퀴즈별로 현재 학생이 선택한 보기 인덱스 상태
  const initialSelections: Record<string, number> = {};
  const initialSubmitted: Record<string, boolean> = {};

  for (const q of quizzes) {
    const myAttempt = q.attempts?.find((a) => a.student_id === currentUserId);
    if (myAttempt) {
      initialSelections[q.id] = myAttempt.selected_option_index;
      initialSubmitted[q.id] = true;
    }
  }

  const [selectedOptions, setSelectedOptions] =
    useState<Record<string, number>>(initialSelections);
  const [submittedMap, setSubmittedMap] =
    useState<Record<string, boolean>>(initialSubmitted);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  if (!quizzes || quizzes.length === 0) {
    return null;
  }

  const solvedCount = Object.keys(submittedMap).filter((k) => submittedMap[k]).length;

  async function handleSubmitQuiz(quiz: FormativeQuiz) {
    const selectedIdx = selectedOptions[quiz.id];
    if (selectedIdx === undefined) return;

    setSubmittingId(quiz.id);
    const isCorrect = selectedIdx === quiz.correct_option_index;

    try {
      const res = await submitQuizAnswerAction(
        lessonId,
        classId,
        quiz.id,
        selectedIdx,
        isCorrect
      );
      if (res.success) {
        setSubmittedMap((prev) => ({ ...prev, [quiz.id]: true }));
      } else {
        alert(res.error || '답안 제출 중 오류가 발생했습니다.');
      }
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <div className="rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50/70 via-white to-purple-50/50 p-6 shadow-sm space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-indigo-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-indigo-600 px-2.5 py-0.5 text-xs font-extrabold text-white">
              맞춤형 형성평가
            </span>
            <h2 className="text-lg font-extrabold text-gray-900">
              🎯 우리 반 질문 기반 확인 퀴즈 (Exit Ticket)
            </h2>
          </div>
          <p className="text-xs text-gray-600 mt-1">
            이번 수업에서 우리 반 친구들이 실제로 가장 많이 질문하고 헷갈려한 개념을 점검하는 문제입니다.
          </p>
        </div>

        <div className="shrink-0 rounded-xl bg-white border border-indigo-200 px-3.5 py-2 text-xs font-bold text-indigo-800 shadow-2xs">
          진행 현황: {solvedCount} / {quizzes.length} 문항 완료
        </div>
      </div>

      <div className="space-y-5">
        {quizzes.map((quiz, qIdx) => {
          const selectedIdx = selectedOptions[quiz.id];
          const isSubmitted = Boolean(submittedMap[quiz.id]);
          const isCorrect = selectedIdx === quiz.correct_option_index;

          return (
            <div
              key={quiz.id}
              className="rounded-2xl border border-gray-200 bg-white p-5 shadow-2xs space-y-4"
            >
              {/* 문항 헤더 및 출제 근거 */}
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-xs font-extrabold text-indigo-800">
                    문항 {qIdx + 1}
                  </span>
                  {quiz.target_concept && (
                    <span className="rounded-md bg-purple-50 border border-purple-200 px-2 py-0.5 text-[11px] font-bold text-purple-700">
                      #{quiz.target_concept}
                    </span>
                  )}
                  {quiz.rationale && (
                    <span className="text-[11px] text-gray-500 font-medium">
                      💡 출제 근거: {quiz.rationale}
                    </span>
                  )}
                </div>

                <h3 className="text-base font-bold text-gray-900 pt-1 leading-snug">
                  {quiz.question_text}
                </h3>
              </div>

              {/* 4지선다 보기 목록 */}
              <div className="grid gap-2">
                {quiz.options.map((optionText, optIdx) => {
                  const isThisSelected = selectedIdx === optIdx;
                  const isThisCorrectAnswer = optIdx === quiz.correct_option_index;

                  let btnStyle =
                    'border-gray-200 bg-gray-50/60 text-gray-800 hover:bg-gray-100';

                  if (isSubmitted) {
                    if (isThisCorrectAnswer) {
                      btnStyle =
                        'border-emerald-500 bg-emerald-50 text-emerald-950 font-bold ring-1 ring-emerald-400';
                    } else if (isThisSelected && !isThisCorrectAnswer) {
                      btnStyle =
                        'border-rose-400 bg-rose-50 text-rose-900 font-semibold';
                    } else {
                      btnStyle = 'border-gray-100 bg-gray-50/40 text-gray-400';
                    }
                  } else if (isThisSelected) {
                    btnStyle =
                      'border-indigo-600 bg-indigo-50/80 text-indigo-950 font-bold ring-2 ring-indigo-200';
                  }

                  return (
                    <button
                      key={optIdx}
                      type="button"
                      onClick={() => {
                        setSelectedOptions((prev) => ({
                          ...prev,
                          [quiz.id]: optIdx,
                        }));
                        if (isSubmitted) {
                          setSubmittedMap((prev) => ({
                            ...prev,
                            [quiz.id]: false,
                          }));
                        }
                      }}
                      className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-xs sm:text-sm transition ${btnStyle}`}
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current text-xs font-bold">
                          {optIdx + 1}
                        </span>
                        <span className="leading-relaxed">{optionText}</span>
                      </div>

                      {isSubmitted && isThisCorrectAnswer && (
                        <span className="shrink-0 rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white">
                          정답
                        </span>
                      )}
                      {isSubmitted && isThisSelected && !isThisCorrectAnswer && (
                        <span className="shrink-0 rounded-full bg-rose-600 px-2 py-0.5 text-[11px] font-bold text-white">
                          내 선택
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* 제출 버튼 또는 채점 결과/해설 카드 */}
              <div className="flex items-center justify-between pt-1">
                {!isSubmitted ? (
                  <button
                    type="button"
                    disabled={
                      selectedIdx === undefined || submittingId === quiz.id
                    }
                    onClick={() => handleSubmitQuiz(quiz)}
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-40 transition"
                  >
                    {submittingId === quiz.id
                      ? '채점 및 저장 중...'
                      : '정답 확인 및 제출하기'}
                  </button>
                ) : (
                  <div className="w-full rounded-xl border border-indigo-100 bg-slate-50 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-extrabold ${
                          isCorrect ? 'text-emerald-700' : 'text-rose-600'
                        }`}
                      >
                        {isCorrect
                          ? '🎉 정답입니다! 오개념 없이 정확히 이해했네요.'
                          : '💡 아쉬워요! 아래 해설을 읽고 헷갈렸던 개념을 바로잡아 보세요.'}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setSubmittedMap((prev) => ({
                            ...prev,
                            [quiz.id]: false,
                          }))
                        }
                        className="text-[11px] font-semibold text-indigo-600 hover:underline"
                      >
                        다시 풀기
                      </button>
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed">
                      <strong className="text-gray-900">해설:</strong>{' '}
                      {quiz.explanation}
                    </p>
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
