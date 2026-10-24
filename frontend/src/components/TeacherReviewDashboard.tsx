'use client';

import { useState } from 'react';
import {
  requestAiLessonReview,
  applyMaterialPatchAction,
  publishFormativeQuizzesAction,
} from '@/app/lessons/actions';
import {
  Submission,
  QuestionGroup,
  AiLessonAnalysisResult,
  MaterialGapItem,
  GeneratedQuizDraft,
  FormativeQuiz,
  AppliedPatchItem,
} from '@/types/database.types';

interface TeacherReviewDashboardProps {
  lessonId: string;
  classId: string;
  lessonTitle: string;
  learningObjective: string;
  totalStudents: number;
  submissions: Submission[];
  groups: QuestionGroup[];
  initialAnalysis: AiLessonAnalysisResult | null;
  appliedPatches: AppliedPatchItem[];
  publishedQuizzes: FormativeQuiz[];
}

export default function TeacherReviewDashboard({
  lessonId,
  classId,
  lessonTitle,
  learningObjective,
  totalStudents,
  submissions,
  groups,
  initialAnalysis,
  appliedPatches,
  publishedQuizzes,
}: TeacherReviewDashboardProps) {
  const [analysis, setAnalysis] = useState<AiLessonAnalysisResult | null>(
    initialAnalysis
  );
  const [quizDrafts, setQuizDrafts] = useState<GeneratedQuizDraft[]>(
    initialAnalysis?.formative_quizzes || []
  );
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 각 Gap 항목별 패치 중 상태 및 완료 상태
  const [patchingId, setPatchingId] = useState<string | null>(null);
  const [patchedIds, setPatchedIds] = useState<Record<string, boolean>>({});
  const [editedPatches, setEditedPatches] = useState<
    Record<string, { title: string; markdown: string }>
  >({});

  // 형성평가 배포 상태
  const [publishingQuiz, setPublishingQuiz] = useState(false);
  const [quizPublishSuccess, setQuizPublishSuccess] = useState(false);

  const submittedCount = submissions.length;
  const submissionRate =
    totalStudents > 0 ? Math.round((submittedCount / totalStudents) * 100) : 0;

  const resolvedGroups = groups.filter((g) => g.is_resolved);
  const unresolvedGroups = groups.filter((g) => !g.is_resolved);
  const confusions = submissions.filter((s) => s.type === 'confusion');

  // 배포된 퀴즈 전체 평균 정답률 계산
  const totalQuizAttempts = publishedQuizzes.reduce(
    (acc, q) => acc + (q.attempts?.length || 0),
    0
  );
  const totalCorrectAttempts = publishedQuizzes.reduce(
    (acc, q) => acc + (q.attempts?.filter((a) => a.is_correct).length || 0),
    0
  );
  const overallQuizAccuracy =
    totalQuizAttempts > 0
      ? Math.round((totalCorrectAttempts / totalQuizAttempts) * 100)
      : null;

  async function handleGenerateReview() {
    setLoading(true);
    setErrorMessage(null);
    setQuizPublishSuccess(false);
    try {
      const res = await requestAiLessonReview(
        lessonId,
        classId,
        learningObjective,
        lessonTitle
      );
      if (!res.success || !res.analysis) {
        setErrorMessage(res.error || '교안 진단 및 형성평가 생성에 실패했습니다.');
      } else {
        setAnalysis(res.analysis);
        setQuizDrafts(res.analysis.formative_quizzes || []);
      }
    } catch {
      setErrorMessage('AI 교안 분석 요청 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  function getPatchDraft(item: MaterialGapItem) {
    return (
      editedPatches[item.id] || {
        title: item.suggested_patch_title,
        markdown: item.suggested_patch_markdown,
      }
    );
  }

  async function handleApplyPatch(item: MaterialGapItem) {
    const draft = getPatchDraft(item);
    if (!draft.markdown.trim()) return;

    setPatchingId(item.id);
    try {
      const res = await applyMaterialPatchAction(
        lessonId,
        classId,
        draft.title,
        draft.markdown,
        item.related_questions_summary
      );
      if (res.success) {
        setPatchedIds((prev) => ({ ...prev, [item.id]: true }));
      } else {
        alert(res.error || '교안 패치 적용에 실패했습니다.');
      }
    } finally {
      setPatchingId(null);
    }
  }

  async function handlePublishQuizzes() {
    if (quizDrafts.length === 0) return;
    setPublishingQuiz(true);
    setQuizPublishSuccess(false);
    try {
      const res = await publishFormativeQuizzesAction(
        lessonId,
        classId,
        quizDrafts
      );
      if (res.success) {
        setQuizPublishSuccess(true);
      } else {
        alert(res.error || '형성평가 배포에 실패했습니다.');
      }
    } finally {
      setPublishingQuiz(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* 1. 상단 종합 메트릭 카드 */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="border-b border-gray-100 pb-4 mb-5">
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
            교안-질문-형성평가 선순환 루프
          </span>
          <h2 className="text-xl font-bold text-gray-900 mt-0.5">
            교안 취약점 진단 · 원클릭 패치 · 맞춤형 형성평가 스튜디오
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            업로드한 교안 원문과 학생 질문을 대조하여 교안의 빈틈을 보완(Patch)하고, 학생들의 실제 오개념을 겨냥한 형성평가를 배포합니다.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
            <div className="text-xs font-semibold text-gray-500">학생 질문 제출률</div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-extrabold text-gray-900">
                {submissionRate}%
              </span>
              <span className="text-xs text-gray-400">
                ({submittedCount}/{totalStudents}명)
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4">
            <div className="text-xs font-semibold text-amber-800">
              미해결 질문 / 혼란
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-extrabold text-amber-900">
                {unresolvedGroups.length}건
              </span>
              <span className="text-xs text-amber-700 font-semibold">
                (혼란 {confusions.length}건)
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
            <div className="text-xs font-semibold text-emerald-700">
              반영된 교안 패치
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-extrabold text-emerald-900">
                {appliedPatches.length}건
              </span>
              <span className="text-xs text-emerald-600 font-bold">
                (학생 화면 반영)
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
            <div className="text-xs font-semibold text-indigo-700">
              형성평가 학급 정답률
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-extrabold text-indigo-900">
                {overallQuizAccuracy !== null ? `${overallQuizAccuracy}%` : '-'}
              </span>
              <span className="text-xs text-indigo-600 font-semibold">
                ({publishedQuizzes.length}문항 배포됨)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. 배포된 형성평가 실시간 학급 응시 & 오개념 해소 현황 (배포된 퀴즈가 있을 때) */}
      {publishedQuizzes.length > 0 && (
        <div className="rounded-2xl border border-indigo-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
            <div>
              <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-[11px] font-extrabold text-indigo-800">
                실시간 채점 집계
              </span>
              <h3 className="text-base font-extrabold text-gray-900 mt-1">
                📊 배포된 맞춤형 형성평가 학급 정답률 및 선지 반응 분포
              </h3>
            </div>
            <span className="text-xs text-gray-500">
              총 응시 건수: <strong className="text-indigo-700">{totalQuizAttempts}회</strong>
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {publishedQuizzes.map((q, idx) => {
              const attempts = q.attempts || [];
              const correctCount = attempts.filter((a) => a.is_correct).length;
              const rate =
                attempts.length > 0
                  ? Math.round((correctCount / attempts.length) * 100)
                  : 0;

              return (
                <div
                  key={q.id}
                  className="rounded-xl border border-gray-200 bg-slate-50/60 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-indigo-700">
                      문항 {idx + 1} {q.target_concept ? `(${q.target_concept})` : ''}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-extrabold ${
                        attempts.length === 0
                          ? 'bg-gray-100 text-gray-500'
                          : rate >= 70
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {attempts.length === 0
                        ? '응시 대기'
                        : `정답률 ${rate}% (${correctCount}/${attempts.length}명)`}
                    </span>
                  </div>

                  <p className="text-xs font-bold text-gray-900 line-clamp-2">
                    {q.question_text}
                  </p>

                  <div className="space-y-1">
                    {q.options.map((opt, oIdx) => {
                      const pickCount = attempts.filter(
                        (a) => a.selected_option_index === oIdx
                      ).length;
                      const isCorrectOpt = oIdx === q.correct_option_index;
                      return (
                        <div
                          key={oIdx}
                          className={`flex items-center justify-between rounded-lg px-2.5 py-1 text-[11px] ${
                            isCorrectOpt
                              ? 'bg-emerald-50 text-emerald-900 font-bold border border-emerald-200'
                              : pickCount > 0
                              ? 'bg-rose-50/70 text-rose-800'
                              : 'bg-white text-gray-500'
                          }`}
                        >
                          <span className="truncate pr-2">
                            {oIdx + 1}. {opt}
                          </span>
                          <span className="shrink-0 font-mono font-bold">
                            {pickCount}명
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. ✨ AI 교안 취약점(Gap) 진단 & 원클릭 패치 & 형성평가 생성 워크스페이스 */}
      <div className="rounded-2xl border-2 border-purple-200 bg-gradient-to-br from-purple-50/50 via-white to-indigo-50/40 p-6 shadow-sm space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-purple-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-purple-600 px-2.5 py-0.5 text-xs font-extrabold text-white">
                AI 교안 진화 엔진
              </span>
              <h3 className="text-lg font-extrabold text-gray-900">
                교안 원문 대조 취약점(Gap) 진단 & 형성평가 자동 설계
              </h3>
            </div>
            <p className="text-xs text-gray-600 mt-1">
              단순 질문 요약이 아닙니다. 업로드된 교안 본문에서 설명이 부족했던 지점을 정확히 찾아내어 <strong>원클릭 보충 패치</strong>와 <strong>맞춤형 형성평가</strong>를 생성합니다.
            </p>
          </div>

          <button
            onClick={handleGenerateReview}
            disabled={loading || submissions.length === 0}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-purple-500/20 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 transition cursor-pointer"
          >
            <span>✨</span>
            <span>
              {loading
                ? '교안 대조 분석 및 문항 설계 중...'
                : analysis
                ? '최신 질문으로 다시 진단하기'
                : '교안 취약점 진단 & 형성평가 생성'}
            </span>
          </button>
        </div>

        {submissions.length === 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-xs text-amber-800 font-medium">
            💡 아직 제출된 학생 질문이 없습니다. 학생들이 질문을 1건 이상 제출하면 교안 대비 취약점 분석을 실행할 수 있습니다.
          </div>
        )}

        {errorMessage && (
          <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-xs text-red-600 font-medium">
            {errorMessage}
          </div>
        )}

        {analysis && (
          <div className="space-y-8">
            {/* (A) 객관적 교안 진단 총평 & 다음 시간 5분 복습 가이드 */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-purple-200 bg-white p-5 shadow-2xs space-y-2">
                <div className="text-xs font-extrabold text-purple-700 flex items-center gap-1.5">
                  <span>🎯</span>
                  <span>교안 원문 vs 학생 질문 객관적 Gap 총평</span>
                </div>
                <p className="text-xs sm:text-sm text-gray-800 leading-relaxed font-medium">
                  {analysis.overall_diagnosis}
                </p>
              </div>

              <div className="rounded-2xl border border-indigo-200 bg-white p-5 shadow-2xs space-y-2">
                <div className="text-xs font-extrabold text-indigo-700 flex items-center gap-1.5">
                  <span>⏱️</span>
                  <span>다음 수업 도입부 5분 원포인트 복습 가이드</span>
                </div>
                <p className="text-xs sm:text-sm text-gray-800 leading-relaxed">
                  {analysis.next_class_opening_guide}
                </p>
              </div>
            </div>

            {/* (B) 교안의 부족했던 점(Gap Items) 및 원클릭 교안 패치 */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                    <span>🛠️</span>
                    <span>1단계: 교안의 부족했던 점 진단 & 원클릭 보충 패치</span>
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    AI가 작성한 보충 설명을 검토·수정한 뒤 <strong>[교안에 원클릭 패치 적용]</strong>을 누르면 학생들의 교안 화면에 즉시 추가됩니다.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {analysis.gap_items.map((item, idx) => {
                  const draft = getPatchDraft(item);
                  const isPatched = Boolean(patchedIds[item.id]);
                  const isPatching = patchingId === item.id;

                  return (
                    <div
                      key={item.id || idx}
                      className="rounded-2xl border border-gray-200 bg-white p-5 shadow-2xs space-y-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-gray-100 pb-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-md bg-rose-100 px-2 py-0.5 text-xs font-extrabold text-rose-800">
                              교안 보완 지점 #{idx + 1}
                            </span>
                            <span className="text-sm font-extrabold text-gray-900">
                              {item.target_section}
                            </span>
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                              관련 학생 질문 {item.student_count}건
                            </span>
                          </div>
                          <p className="text-xs text-rose-700 font-semibold mt-1">
                            ⚠️ 교안의 부족했던 점: {item.critique}
                          </p>
                          <p className="text-xs text-gray-500">
                            💬 실제 학생 질문 요약: &ldquo;{item.related_questions_summary}&rdquo;
                          </p>
                        </div>
                      </div>

                      {/* 패치 편집 및 원클릭 반영 영역 */}
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-emerald-900">
                            ✨ 교안에 추가할 학생 눈높이 보충 설명 패치 (수정 가능)
                          </span>
                          {isPatched && (
                            <span className="text-xs font-extrabold text-emerald-700">
                              ✅ 상단 수업 교안에 패치 반영 완료!
                            </span>
                          )}
                        </div>

                        <input
                          type="text"
                          value={draft.title}
                          onChange={(e) =>
                            setEditedPatches((prev) => ({
                              ...prev,
                              [item.id]: {
                                ...draft,
                                title: e.target.value,
                              },
                            }))
                          }
                          className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-900"
                        />

                        <textarea
                          rows={4}
                          value={draft.markdown}
                          onChange={(e) =>
                            setEditedPatches((prev) => ({
                              ...prev,
                              [item.id]: {
                                ...draft,
                                markdown: e.target.value,
                              },
                            }))
                          }
                          className="w-full rounded-lg border border-emerald-200 bg-white p-3 text-xs text-gray-800 leading-relaxed"
                        />

                        <div className="flex justify-end">
                          <button
                            type="button"
                            disabled={isPatching}
                            onClick={() => handleApplyPatch(item)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 transition cursor-pointer"
                          >
                            <span>✨</span>
                            <span>
                              {isPatching
                                ? '교안에 패치 적용 중...'
                                : isPatched
                                ? '추가 보충 패치로 한 번 더 등록'
                                : '교안에 이 보충 설명 원클릭 패치하기'}
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* (C) 학생 오개념 타겟팅 형성평가 빌더 & 원클릭 배포 */}
            <div className="space-y-4 pt-2 border-t border-purple-100">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h4 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                    <span>📝</span>
                    <span>
                      2단계: 우리 반 질문 기반 맞춤형 형성평가 (Exit Ticket) 검토 및 배포
                    </span>
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    학생들이 실제로 헷갈려한 오개념을 오답 선지로 반영한 맞춤형 문항입니다. 검토 후 학생 화면에 즉시 배포하세요.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={publishingQuiz || quizDrafts.length === 0}
                  onClick={handlePublishQuizzes}
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-extrabold text-white shadow-md shadow-indigo-500/20 hover:bg-indigo-700 disabled:opacity-50 transition cursor-pointer"
                >
                  <span>🚀</span>
                  <span>
                    {publishingQuiz
                      ? '학생 화면에 배포 중...'
                      : publishedQuizzes.length > 0
                      ? '형성평가 문항 업데이트 재배포'
                      : `학생 화면에 형성평가 ${quizDrafts.length}문항 배포하기`}
                  </span>
                </button>
              </div>

              {quizPublishSuccess && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-bold text-emerald-800">
                  🎉 형성평가 {quizDrafts.length}문항이 학생 화면에 성공적으로 배포되었습니다! 이제 학생들이 직접 문제를 풀고 해설을 확인할 수 있습니다.
                </div>
              )}

              <div className="space-y-4">
                {quizDrafts.map((quiz, qIdx) => (
                  <div
                    key={qIdx}
                    className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-2xs space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-indigo-600 px-2 py-0.5 text-xs font-extrabold text-white">
                          문항 {qIdx + 1}
                        </span>
                        <span className="rounded-md bg-purple-50 border border-purple-200 px-2 py-0.5 text-[11px] font-bold text-purple-700">
                          점검 개념: {quiz.target_concept}
                        </span>
                      </div>
                      <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-0.5">
                        📌 출제 근거: {quiz.rationale}
                      </span>
                    </div>

                    {/* 문제 발문 편집 */}
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 mb-1">
                        문제 발문 (클릭하여 수정 가능)
                      </label>
                      <input
                        type="text"
                        value={quiz.question_text}
                        onChange={(e) => {
                          const updated = [...quizDrafts];
                          updated[qIdx] = {
                            ...quiz,
                            question_text: e.target.value,
                          };
                          setQuizDrafts(updated);
                        }}
                        className="w-full rounded-xl border border-gray-200 px-3.5 py-2 text-xs sm:text-sm font-bold text-gray-900"
                      />
                    </div>

                    {/* 4지선다 보기 및 정답 지정 */}
                    <div className="grid gap-2 sm:grid-cols-2">
                      {quiz.options.map((opt, optIdx) => {
                        const isCorrect = quiz.correct_option_index === optIdx;
                        return (
                          <div
                            key={optIdx}
                            className={`flex items-center gap-2 rounded-xl border p-2.5 ${
                              isCorrect
                                ? 'border-emerald-400 bg-emerald-50/60'
                                : 'border-gray-200 bg-gray-50/40'
                            }`}
                          >
                            <button
                              type="button"
                              title="클릭하여 정답 선지로 지정"
                              onClick={() => {
                                const updated = [...quizDrafts];
                                updated[qIdx] = {
                                  ...quiz,
                                  correct_option_index: optIdx,
                                };
                                setQuizDrafts(updated);
                              }}
                              className={`h-6 w-6 shrink-0 rounded-full text-xs font-extrabold transition ${
                                isCorrect
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-100'
                              }`}
                            >
                              {optIdx + 1}
                            </button>
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => {
                                const newOptions = [...quiz.options];
                                newOptions[optIdx] = e.target.value;
                                const updated = [...quizDrafts];
                                updated[qIdx] = {
                                  ...quiz,
                                  options: newOptions,
                                };
                                setQuizDrafts(updated);
                              }}
                              className="w-full bg-transparent text-xs font-medium text-gray-800 focus:outline-none"
                            />
                            {isCorrect && (
                              <span className="shrink-0 text-[10px] font-extrabold text-emerald-700">
                                정답
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* 해설 편집 */}
                    <div className="rounded-xl bg-slate-50 p-3 text-xs text-gray-700">
                      <span className="font-bold text-gray-900">💡 학생용 해설: </span>
                      <span>{quiz.explanation}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
