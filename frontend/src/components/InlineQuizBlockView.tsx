'use client';

import { useState, useEffect } from 'react';
import { FormativeQuiz, QuizQuestionType } from '@/types/database.types';
import { InlineQuizBlockData } from '@/utils/notionBlocks';
import { checkShortAnswerMatch } from '@/utils/quizHelper';
import { submitInlineQuizAttemptAction } from '@/app/lessons/actions';

interface InlineQuizBlockViewProps {
  rawJson: string;
  lessonId?: string;
  classId?: string;
  currentUserId?: string;
  isTeacher?: boolean;
  inlineQuizzesMap?: Record<string, FormativeQuiz>;
}

export default function InlineQuizBlockView({
  rawJson,
  lessonId,
  classId,
  currentUserId,
  isTeacher = false,
  inlineQuizzesMap,
}: InlineQuizBlockViewProps) {
  let parsedQuiz: InlineQuizBlockData | null = null;
  try {
    const obj = JSON.parse(rawJson.trim());
    if (obj && typeof obj === 'object') {
      const rawType = obj.questionType || obj.question_type;
      const qType: QuizQuestionType =
        rawType === 'ox' || rawType === 'short_answer'
          ? rawType
          : 'multiple_choice';
      const rawId = obj.quizId || obj.id;
      parsedQuiz = {
        quizId: typeof rawId === 'string' && rawId.trim() ? rawId.trim() : 'iq_default',
        questionType: qType,
        questionText:
          typeof obj.questionText === 'string'
            ? obj.questionText
            : typeof obj.question === 'string'
            ? obj.question
            : '',
        options: Array.isArray(obj.options)
          ? obj.options.map((o: unknown) => String(o ?? ''))
          : qType === 'ox'
          ? ['O (맞음)', 'X (틀림)']
          : ['선택지 1', '선택지 2', '선택지 3', '선택지 4'],
        correctOptionIndex:
          typeof obj.correctOptionIndex === 'number'
            ? obj.correctOptionIndex
            : typeof obj.correct_option_index === 'number'
            ? obj.correct_option_index
            : 0,
        answerText:
          typeof obj.answerText === 'string'
            ? obj.answerText
            : typeof obj.answer_text === 'string'
            ? obj.answer_text
            : '',
        explanation: typeof obj.explanation === 'string' ? obj.explanation : '',
        targetConcept:
          typeof obj.targetConcept === 'string'
            ? obj.targetConcept
            : typeof obj.target_concept === 'string'
            ? obj.target_concept
            : '',
      };
    }
  } catch {
    parsedQuiz = null;
  }

  const persistedQuiz = parsedQuiz ? inlineQuizzesMap?.[parsedQuiz.quizId] : undefined;
  const myExistingAttempt =
    persistedQuiz && currentUserId && persistedQuiz.attempts
      ? persistedQuiz.attempts.find((a) => a.student_id === currentUserId)
      : undefined;

  const [selectedIdx, setSelectedIdx] = useState<number | null>(
    myExistingAttempt ? myExistingAttempt.selected_option_index : null
  );
  const [shortAnswerInput, setShortAnswerInput] = useState<string>(
    myExistingAttempt?.submitted_text || ''
  );
  const [submittedResult, setSubmittedResult] = useState<{
    isCorrect: boolean;
    selectedIdx: number;
    submittedText?: string;
  } | null>(
    myExistingAttempt
      ? {
          isCorrect: myExistingAttempt.is_correct,
          selectedIdx: myExistingAttempt.selected_option_index,
          submittedText: myExistingAttempt.submitted_text,
        }
      : null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [prefillSuccessToast, setPrefillSuccessToast] = useState(false);

  useEffect(() => {
    if (myExistingAttempt) {
      setSelectedIdx(myExistingAttempt.selected_option_index);
      setShortAnswerInput(myExistingAttempt.submitted_text || '');
      setSubmittedResult({
        isCorrect: myExistingAttempt.is_correct,
        selectedIdx: myExistingAttempt.selected_option_index,
        submittedText: myExistingAttempt.submitted_text,
      });
    }
  }, [
    myExistingAttempt?.selected_option_index,
    myExistingAttempt?.submitted_text,
    myExistingAttempt?.is_correct,
  ]);

  if (!parsedQuiz) {
    return null;
  }

  const qType: QuizQuestionType = parsedQuiz.questionType || 'multiple_choice';
  const options =
    qType === 'ox'
      ? ['O (맞음)', 'X (틀림)']
      : parsedQuiz.options && parsedQuiz.options.length > 0
      ? parsedQuiz.options
      : ['선택지 1', '선택지 2', '선택지 3', '선택지 4'];

  const handleCheckAnswer = async () => {
    if (qType === 'short_answer') {
      if (!shortAnswerInput.trim()) return;
    } else {
      if (selectedIdx === null) return;
    }

    setErrorMsg(null);

    // 수업 페이지 내부이며 서버 저장이 가능한 경우
    if (lessonId && classId && currentUserId) {
      setIsSubmitting(true);
      const res = await submitInlineQuizAttemptAction(
        lessonId,
        classId,
        parsedQuiz,
        {
          selectedOptionIndex: qType === 'short_answer' ? 0 : selectedIdx ?? 0,
          submittedText: qType === 'short_answer' ? shortAnswerInput.trim() : undefined,
        }
      );
      setIsSubmitting(false);

      if (res?.error) {
        setErrorMsg(res.error);
        return;
      }

      const isCorrect = Boolean(res?.isCorrect);
      setSubmittedResult({
        isCorrect,
        selectedIdx: qType === 'short_answer' ? 0 : selectedIdx ?? 0,
        submittedText: qType === 'short_answer' ? shortAnswerInput.trim() : undefined,
      });
      return;
    }

    // 미리보기 모드 (DB 저장 없이 즉시 클라이언트 채점)
    const isCorrect =
      qType === 'short_answer'
        ? checkShortAnswerMatch(shortAnswerInput, parsedQuiz.answerText || '')
        : selectedIdx === parsedQuiz.correctOptionIndex;

    setSubmittedResult({
      isCorrect,
      selectedIdx: qType === 'short_answer' ? 0 : selectedIdx ?? 0,
      submittedText: qType === 'short_answer' ? shortAnswerInput.trim() : undefined,
    });
  };

  const handleAskQuestionDirectly = () => {
    const conceptPrefix = parsedQuiz.targetConcept
      ? `[${parsedQuiz.targetConcept} 관련 퀴즈 질문] `
      : `[체크포인트 퀴즈 질문] `;

    const myWrongChoiceText =
      qType === 'short_answer'
        ? `제가 '${submittedResult?.submittedText || shortAnswerInput}'(으)로 답했는데`
        : submittedResult && options[submittedResult.selectedIdx]
        ? `제가 '${options[submittedResult.selectedIdx]}' 보기를 골랐는데`
        : '문제를 풀어보았는데';

    const draftQuestion = `${conceptPrefix}"${parsedQuiz.questionText}" 문제에서 ${myWrongChoiceText} 왜 정답이 되는지(또는 오답인지) 원리가 조금 더 궁금합니다!`;

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('qclass:prefill-question', {
          detail: {
            type: 'confusion',
            content: draftQuestion,
          },
        })
      );

      const formEl = document.getElementById('student-submission-form');
      if (formEl) {
        formEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      setPrefillSuccessToast(true);
      setTimeout(() => setPrefillSuccessToast(false), 3500);
    }
  };

  // 교사용 실시간 응답 집계
  const attempts = persistedQuiz?.attempts || [];
  const totalAttempts = attempts.length;
  const correctAttempts = attempts.filter((a) => a.is_correct).length;
  const accuracyRate =
    totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : null;

  return (
    <div className="my-5 overflow-hidden rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50/60 via-white to-violet-50/40 shadow-sm">
      {/* 상단 배지 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100 bg-indigo-50/80 px-5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-extrabold text-white shadow-2xs">
            <span>🎯</span>
            <span>체크포인트 퀴즈</span>
          </span>
          <span className="rounded-lg border border-indigo-200 bg-white px-2.5 py-0.5 text-[11px] font-bold text-indigo-700">
            {qType === 'ox'
              ? '⭕❌ OX 퀴즈'
              : qType === 'short_answer'
              ? '✍️ 단답형 확인'
              : '🔢 객관식 확인'}
          </span>
          {parsedQuiz.targetConcept && (
            <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-[11px] font-extrabold text-violet-800">
              #{parsedQuiz.targetConcept}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {submittedResult && (
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${
                submittedResult.isCorrect
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {submittedResult.isCorrect ? '✅ 정답 확인 완료' : '💡 오답 노트 확인'}
            </span>
          )}
          {isTeacher && (
            <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-[11px] font-bold text-white">
              👩‍🏫 교사 미리보기 · 실시간 리포트
            </span>
          )}
        </div>
      </div>

      {/* 본문 영역 */}
      <div className="p-5 space-y-4">
        <div className="text-base font-extrabold text-gray-900 leading-snug">
          Q. {parsedQuiz.questionText || '질문이 입력되지 않았습니다.'}
        </div>

        {/* 1) 4지선다 객관식 */}
        {qType === 'multiple_choice' && (
          <div className="grid grid-cols-1 gap-2">
            {options.map((opt, oIdx) => {
              const isSelected = selectedIdx === oIdx;
              const isCorrectOption = parsedQuiz.correctOptionIndex === oIdx;

              let btnStyle =
                'border-gray-200 bg-white text-gray-800 hover:border-indigo-300 hover:bg-indigo-50/40';
              if (submittedResult) {
                if (isCorrectOption) {
                  btnStyle =
                    'border-emerald-500 bg-emerald-50/90 text-emerald-950 font-bold ring-1 ring-emerald-400';
                } else if (isSelected && !isCorrectOption) {
                  btnStyle = 'border-rose-400 bg-rose-50/80 text-rose-900 font-semibold';
                } else {
                  btnStyle = 'border-gray-100 bg-gray-50/60 text-gray-400';
                }
              } else if (isSelected) {
                btnStyle =
                  'border-indigo-600 bg-indigo-50/80 text-indigo-950 font-bold ring-1 ring-indigo-500';
              }

              return (
                <button
                  key={oIdx}
                  type="button"
                  disabled={Boolean(submittedResult)}
                  onClick={() => setSelectedIdx(oIdx)}
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition cursor-pointer disabled:cursor-default ${btnStyle}`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${
                        submittedResult && isCorrectOption
                          ? 'bg-emerald-600 text-white'
                          : submittedResult && isSelected && !isCorrectOption
                          ? 'bg-rose-500 text-white'
                          : isSelected
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {oIdx + 1}
                    </span>
                    <span>{opt}</span>
                  </div>
                  {submittedResult && isCorrectOption && (
                    <span className="shrink-0 text-xs font-extrabold text-emerald-700">
                      정답 ✓
                    </span>
                  )}
                  {submittedResult && isSelected && !isCorrectOption && (
                    <span className="shrink-0 text-xs font-bold text-rose-600">
                      내가 고른 보기
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* 2) OX 퀴즈 */}
        {qType === 'ox' && (
          <div className="grid grid-cols-2 gap-3">
            {[
              { idx: 0, symbol: '⭕', label: 'O (맞다)' },
              { idx: 1, symbol: '❌', label: 'X (아니다)' },
            ].map((item) => {
              const isSelected = selectedIdx === item.idx;
              const isCorrectOption = parsedQuiz.correctOptionIndex === item.idx;

              let btnStyle =
                'border-gray-200 bg-white text-gray-800 hover:border-indigo-300 hover:bg-indigo-50/40';
              if (submittedResult) {
                if (isCorrectOption) {
                  btnStyle =
                    'border-emerald-500 bg-emerald-50/90 text-emerald-950 ring-2 ring-emerald-400';
                } else if (isSelected && !isCorrectOption) {
                  btnStyle = 'border-rose-400 bg-rose-50/80 text-rose-900';
                } else {
                  btnStyle = 'border-gray-100 bg-gray-50/60 text-gray-400';
                }
              } else if (isSelected) {
                btnStyle =
                  'border-indigo-600 bg-indigo-50/90 text-indigo-950 ring-2 ring-indigo-500';
              }

              return (
                <button
                  key={item.idx}
                  type="button"
                  disabled={Boolean(submittedResult)}
                  onClick={() => setSelectedIdx(item.idx)}
                  className={`flex flex-col items-center justify-center gap-1 rounded-2xl border-2 p-4 text-center transition cursor-pointer disabled:cursor-default ${btnStyle}`}
                >
                  <span className="text-2xl">{item.symbol}</span>
                  <span className="text-sm font-extrabold">{item.label}</span>
                  {submittedResult && isCorrectOption && (
                    <span className="mt-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-extrabold text-white">
                      정답 ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* 3) 단답형 퀴즈 */}
        {qType === 'short_answer' && (
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                disabled={Boolean(submittedResult)}
                value={shortAnswerInput}
                onChange={(e) => setShortAnswerInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !submittedResult && shortAnswerInput.trim()) {
                    e.preventDefault();
                    handleCheckAnswer();
                  }
                }}
                placeholder="여기에 핵심 용어나 단답형 정답을 입력하세요..."
                className="flex-1 rounded-xl border border-indigo-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-900 focus:border-indigo-600 focus:outline-none disabled:bg-gray-50"
              />
              {!submittedResult && (
                <button
                  type="button"
                  onClick={handleCheckAnswer}
                  disabled={isSubmitting || !shortAnswerInput.trim()}
                  className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-extrabold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 transition cursor-pointer shrink-0"
                >
                  {isSubmitting ? '채점 중...' : '정답 확인하기'}
                </button>
              )}
            </div>
            {submittedResult && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold text-gray-600">
                  내가 입력한 답:{' '}
                  <strong className="text-gray-900">
                    {submittedResult.submittedText || shortAnswerInput}
                  </strong>
                </span>
                <span className="text-gray-300">|</span>
                <span className="font-semibold text-emerald-700">
                  모범 정답: <strong>{parsedQuiz.answerText || '(미지정)'}</strong>
                </span>
              </div>
            )}
          </div>
        )}

        {errorMsg && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700">
            {errorMsg}
          </div>
        )}

        {/* 객관식 / OX 정답 확인 버튼 */}
        {!submittedResult && qType !== 'short_answer' && (
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={handleCheckAnswer}
              disabled={selectedIdx === null || isSubmitting}
              className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-extrabold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-40 transition cursor-pointer"
            >
              {isSubmitting ? '채점 중...' : '정답 확인하기'}
            </button>
          </div>
        )}

        {/* 채점 결과 + 해설 + 원클릭 질문하기 브릿지 */}
        {submittedResult && (
          <div
            className={`rounded-2xl border p-4 space-y-3 ${
              submittedResult.isCorrect
                ? 'border-emerald-200 bg-emerald-50/70'
                : 'border-amber-300 bg-amber-50/80'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div
                className={`text-sm font-extrabold ${
                  submittedResult.isCorrect ? 'text-emerald-900' : 'text-amber-950'
                }`}
              >
                {submittedResult.isCorrect
                  ? '🎉 정답입니다! 방금 읽은 핵심 원리를 정확히 이해하셨네요.'
                  : '💡 아쉽네요! 아래 해설을 읽고 헷갈리는 부분은 바로 질문으로 남겨보세요.'}
              </div>

              <button
                type="button"
                onClick={() => {
                  setSubmittedResult(null);
                }}
                className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-[11px] font-bold text-gray-700 hover:bg-gray-50 transition cursor-pointer"
              >
                🔄 다시 풀어보기
              </button>
            </div>

            {parsedQuiz.explanation && (
              <div className="rounded-xl bg-white/90 p-3 text-xs text-gray-700 leading-relaxed border border-gray-200/70">
                <strong className="text-indigo-900">해설:</strong> {parsedQuiz.explanation}
              </div>
            )}

            {/* 학생용 질문 브릿지 버튼 (오답일 때 더욱 강조) */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span className="text-[11px] font-medium text-gray-600">
                {submittedResult.isCorrect
                  ? '더 깊이 알고 싶은 점이 있다면 질문 보드에 남겨보세요.'
                  : '왜 이 답이 되는지 이해가 안 된다면 클릭 한 번으로 질문 초안을 채울 수 있어요!'}
              </span>

              <button
                type="button"
                onClick={handleAskQuestionDirectly}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold shadow-xs transition cursor-pointer ${
                  submittedResult.isCorrect
                    ? 'border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50'
                    : 'bg-amber-600 text-white hover:bg-amber-700'
                }`}
              >
                <span>🙋</span>
                <span>이 개념 바로 질문하기</span>
              </button>
            </div>

            {prefillSuccessToast && (
              <div className="rounded-lg bg-indigo-900 px-3 py-1.5 text-[11px] font-bold text-white">
                ✨ 아래 질문 작성 칸에 이 퀴즈 맥락이 자동으로 입력되었습니다! 내용을 확인하고 제출해 보세요.
              </div>
            )}
          </div>
        )}
      </div>

      {/* 교사 전용: 우리 반 실시간 응답률 및 정답률 리포트 바 */}
      {isTeacher && (
        <div className="border-t border-indigo-200 bg-slate-900 px-5 py-3.5 text-white">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold text-indigo-300">
                📊 우리 반 실시간 체크포인트 응답 현황
              </span>
              <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-[11px] font-bold text-gray-300">
                응답 {totalAttempts}명
              </span>
            </div>

            {accuracyRate !== null ? (
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${
                    accuracyRate >= 70
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : accuracyRate >= 50
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  }`}
                >
                  정답률 {accuracyRate}% ({correctAttempts}/{totalAttempts}명)
                </span>
                {accuracyRate < 60 && (
                  <span className="text-[11px] font-bold text-amber-300">
                    ⚠️ 보충 설명 권장 구간
                  </span>
                )}
              </div>
            ) : (
              <span className="text-[11px] text-slate-400">
                아직 풀이한 학생이 없습니다
              </span>
            )}
          </div>

          {totalAttempts > 0 && qType !== 'short_answer' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {options.map((opt, oIdx) => {
                const count = attempts.filter(
                  (a) => a.selected_option_index === oIdx
                ).length;
                const pct = Math.round((count / totalAttempts) * 100);
                const isCorrect = parsedQuiz.correctOptionIndex === oIdx;
                return (
                  <div
                    key={oIdx}
                    className={`rounded-lg border px-2.5 py-1.5 text-[11px] ${
                      isCorrect
                        ? 'border-emerald-500/50 bg-emerald-950/50 text-emerald-200'
                        : 'border-slate-700 bg-slate-800/80 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="truncate">
                        {oIdx + 1}번 {isCorrect ? '(정답)' : ''}
                      </span>
                      <span>
                        {count}명 ({pct}%)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {totalAttempts > 0 && qType === 'short_answer' && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {attempts.slice(0, 8).map((att, i) => (
                <span
                  key={i}
                  className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                    att.is_correct
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                      : 'bg-rose-950 text-rose-300 border border-rose-700'
                  }`}
                >
                  {att.submitted_text || '(빈 답안)'} {att.is_correct ? '⭕' : '❌'}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
