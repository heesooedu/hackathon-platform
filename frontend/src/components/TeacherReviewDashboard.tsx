'use client';

import { useState } from 'react';
import { requestAiLessonReview } from '@/app/lessons/actions';
import { Submission, QuestionGroup } from '@/types/database.types';

interface TeacherReviewDashboardProps {
  lessonId: string;
  lessonTitle: string;
  learningObjective: string;
  totalStudents: number;
  submissions: Submission[];
  groups: QuestionGroup[];
}

export default function TeacherReviewDashboard({
  lessonId,
  lessonTitle,
  learningObjective,
  totalStudents,
  submissions,
  groups,
}: TeacherReviewDashboardProps) {
  const [report, setReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const submittedCount = submissions.length;
  const submissionRate =
    totalStudents > 0 ? Math.round((submittedCount / totalStudents) * 100) : 0;

  const resolvedGroups = groups.filter((g) => g.is_resolved);
  const unresolvedGroups = groups.filter((g) => !g.is_resolved);

  // 학생들이 제출한 '혼란 지점(confusion)' 필터
  const confusions = submissions.filter((s) => s.type === 'confusion');

  async function handleGenerateReview() {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await requestAiLessonReview(lessonId, learningObjective, lessonTitle);
      if (!res.success || !res.report) {
        setErrorMessage(res.error || '리포트 생성에 실패했습니다.');
      } else {
        setReport(res.report);
      }
    } catch {
      setErrorMessage('AI 분석 요청 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* 1. 상단 종합 메트릭 카드 */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="border-b border-gray-100 pb-4 mb-5">
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
            수업 학습 루프 점검
          </span>
          <h2 className="text-xl font-bold text-gray-900 mt-0.5">
            수업 회고 & 미해결 질문 대시보드
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            이번 차시의 질문 해결 성과를 검토하고, 미해결된 오개념을 다음 수업 및 인터랙티브 교안에 반영합니다.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
            <div className="text-xs font-semibold text-gray-500">학생 제출률</div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-extrabold text-gray-900">
                {submissionRate}%
              </span>
              <span className="text-xs text-gray-400">
                ({submittedCount}/{totalStudents}명)
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
            <div className="text-xs font-semibold text-blue-700">발행된 대표 질문</div>
            <div className="mt-1 text-2xl font-extrabold text-blue-900">
              {groups.length}개
            </div>
          </div>

          <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
            <div className="text-xs font-semibold text-emerald-700">해결 완료된 질문</div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-extrabold text-emerald-900">
                {resolvedGroups.length}개
              </span>
              <span className="text-xs text-emerald-600 font-bold">
                (해결률 {groups.length > 0 ? Math.round((resolvedGroups.length / groups.length) * 100) : 0}%)
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-4">
            <div className="text-xs font-semibold text-rose-700">미해결 질문 (복습 필요)</div>
            <div className="mt-1 text-2xl font-extrabold text-rose-900">
              {unresolvedGroups.length}개
            </div>
          </div>
        </div>
      </div>

      {/* 2. 미해결 질문 및 집중 오개념 영역 */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* 미해결 대표 질문 */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50/20 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
            <h3 className="text-sm font-bold text-amber-900 flex items-center gap-1.5">
              <span>⚠️ 다음 시간 복습 필요 (미해결 대표 질문)</span>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-extrabold text-amber-800">
                {unresolvedGroups.length}
              </span>
            </h3>
          </div>

          {unresolvedGroups.length > 0 ? (
            <div className="space-y-2.5">
              {unresolvedGroups.map((g) => (
                <div
                  key={g.id}
                  className="rounded-xl border border-amber-200/80 bg-white p-3 text-xs shadow-2xs"
                >
                  <div className="font-bold text-gray-900 line-clamp-1">
                    {g.representative_title}
                  </div>
                  <p className="mt-1 text-gray-600 line-clamp-2">
                    {g.representative_content}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-emerald-700 font-medium">
              🎉 모든 대표 질문이 해결 완료되었습니다!
            </div>
          )}
        </div>

        {/* 학생들이 제출한 실제 혼란 지점 (Confusion) 모음 */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <span>💭 학생들이 꼽은 혼란 지점 원문</span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-extrabold text-gray-700">
                {confusions.length}
              </span>
            </h3>
          </div>

          {confusions.length > 0 ? (
            <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
              {confusions.map((c) => (
                <div
                  key={c.id}
                  className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-xs"
                >
                  <div className="flex items-center justify-between text-gray-400 mb-1">
                    <span className="font-semibold text-blue-600">
                      {c.student?.name || '학생'}
                    </span>
                    <span>
                      {new Date(c.created_at).toLocaleDateString('ko-KR', {
                        month: 'numeric',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                  <p className="text-gray-800 leading-relaxed">{c.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-gray-400">
              제출된 혼란 지점이 없습니다.
            </div>
          )}
        </div>
      </div>

      {/* 3. ✨ Gemini AI 수업 개선 리포트 생성기 (Closing the Feedback Loop) */}
      <div className="rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50/50 via-white to-indigo-50/50 p-6 shadow-sm space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-purple-100 px-2.5 py-1 text-xs font-extrabold text-purple-700">
                AI 수업 개선 피드백 루프
              </span>
              <h3 className="text-lg font-bold text-gray-900">
                Gemini 수업 분석 & 인터랙티브 교안 개선 리포트
              </h3>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              수집된 오개념과 미해결 질문을 종합 분석하여 다음 시간 복습 포인트와 인터랙티브 시뮬레이터 보완 아이디어를 도출합니다.
            </p>
          </div>

          <button
            onClick={handleGenerateReview}
            disabled={loading || submissions.length === 0}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-purple-500/20 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 transition"
          >
            <span>✨</span>
            <span>{loading ? 'AI 분석 리포트 작성 중...' : '교안 개선 리포트 생성'}</span>
          </button>
        </div>

        {errorMessage && (
          <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-xs text-red-600">
            {errorMessage}
          </div>
        )}

        {/* 생성된 리포트 카드 */}
        {report && (
          <div className="rounded-xl border border-purple-100 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-purple-50 pb-3">
              <span className="text-xs font-bold text-purple-700">
                📋 Gemini 2.5 Flash 교수학습 컨설팅 결과
              </span>
              <span className="text-xs text-gray-400">방금 생성됨</span>
            </div>

            <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed whitespace-pre-wrap">
              {report}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
