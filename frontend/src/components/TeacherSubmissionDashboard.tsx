import { Submission, SubmissionType } from '@/types/database.types';

interface TeacherSubmissionDashboardProps {
  totalStudents: number;
  submissions: Submission[];
}

const TYPE_BADGE: Record<
  SubmissionType,
  { label: string; icon: string; bg: string; text: string }
> = {
  question: {
    label: '질문',
    icon: '❓',
    bg: 'bg-blue-50 border-blue-200',
    text: 'text-blue-700',
  },
  confusion: {
    label: '혼란 지점',
    icon: '💭',
    bg: 'bg-amber-50 border-amber-200',
    text: 'text-amber-700',
  },
  explore: {
    label: '탐구 아이디어',
    icon: '💡',
    bg: 'bg-purple-50 border-purple-200',
    text: 'text-purple-700',
  },
  understood: {
    label: '이해 완료',
    icon: '✅',
    bg: 'bg-emerald-50 border-emerald-200',
    text: 'text-emerald-700',
  },
};

export default function TeacherSubmissionDashboard({
  totalStudents,
  submissions,
}: TeacherSubmissionDashboardProps) {
  const submittedCount = submissions.length;
  const submissionRate =
    totalStudents > 0 ? Math.round((submittedCount / totalStudents) * 100) : 0;

  // 유형별 카운트
  const counts = submissions.reduce(
    (acc, curr) => {
      acc[curr.type] = (acc[curr.type] || 0) + 1;
      return acc;
    },
    { question: 0, confusion: 0, explore: 0, understood: 0 } as Record<
      SubmissionType,
      number
    >
  );

  return (
    <div className="space-y-6">
      {/* 요약 통계 카드 */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-gray-100">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
              학습 상태 수집 현황
            </span>
            <h2 className="text-xl font-bold text-gray-900 mt-0.5">
              학생 제출 대시보드
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-2xl font-extrabold text-gray-900">
                {submittedCount}
                <span className="text-sm font-normal text-gray-400">
                  {' '}
                  / {totalStudents}명
                </span>
              </div>
              <div className="text-xs text-gray-400">제출률 {submissionRate}%</div>
            </div>
            {/* 미니 프로그레스 바 원형 */}
            <div className="relative h-12 w-12 flex items-center justify-center rounded-full bg-blue-50 text-blue-600 font-extrabold text-xs">
              {submissionRate}%
            </div>
          </div>
        </div>

        {/* 4가지 유형별 카운트 칩 */}
        <div className="grid grid-cols-2 gap-3 pt-4 sm:grid-cols-4">
          <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700">
              <span>❓</span>
              <span>궁금한 질문</span>
            </div>
            <div className="mt-2 text-xl font-extrabold text-blue-900">
              {counts.question}건
            </div>
          </div>

          <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700">
              <span>💭</span>
              <span>헷갈리는 지점</span>
            </div>
            <div className="mt-2 text-xl font-extrabold text-amber-900">
              {counts.confusion}건
            </div>
          </div>

          <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-purple-700">
              <span>💡</span>
              <span>더 알고 싶은 점</span>
            </div>
            <div className="mt-2 text-xl font-extrabold text-purple-900">
              {counts.explore}건
            </div>
          </div>

          <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
              <span>✅</span>
              <span>이해 완료 확인</span>
            </div>
            <div className="mt-2 text-xl font-extrabold text-emerald-900">
              {counts.understood}건
            </div>
          </div>
        </div>
      </div>

      {/* 제출된 학생 목록 */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900">
            수집된 학생별 내용 (실시간 {submissions.length}건)
          </h3>
          <span className="text-xs text-gray-400">
            🔒 교사 화면에서는 개별 지도를 위해 실명이 표시됩니다.
          </span>
        </div>

        {submissions.length > 0 ? (
          <div className="space-y-3">
            {submissions.map((sub) => {
              const cfg = TYPE_BADGE[sub.type];
              const studentName = sub.student?.name || '익명 학생';

              return (
                <div
                  key={sub.id}
                  className="rounded-xl border border-gray-100 bg-gray-50/40 p-4 transition hover:bg-gray-50"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                        {studentName.charAt(0)}
                      </div>
                      <span className="font-bold text-sm text-gray-900">
                        {studentName}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold ${cfg.bg} ${cfg.text}`}
                      >
                        <span>{cfg.icon}</span>
                        <span>{cfg.label}</span>
                      </span>
                    </div>

                    <span className="text-xs text-gray-400">
                      {new Date(sub.updated_at).toLocaleString('ko-KR', {
                        month: 'numeric',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <p className="text-sm text-gray-800 leading-relaxed pl-9">
                    {sub.content}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-12 text-center text-gray-400 text-sm">
            아직 제출한 학생이 없습니다. 학생들에게 질문을 남겨달라고 안내해 보세요!
          </div>
        )}
      </div>
    </div>
  );
}

