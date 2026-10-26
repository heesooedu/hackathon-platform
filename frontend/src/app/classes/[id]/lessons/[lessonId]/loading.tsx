export default function LessonDetailLoading() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-8 lg:px-12 space-y-8 animate-pulse">
      {/* 상단 브레드크럼 & 제목 스켈레톤 */}
      <div>
        <div className="h-4 w-44 rounded-md bg-gray-200 mb-4" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-6 w-24 rounded-full bg-emerald-100" />
              <div className="h-6 w-36 rounded-full bg-indigo-50" />
            </div>
            <div className="h-9 w-80 max-w-full rounded-xl bg-gray-200" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-24 rounded-xl bg-gray-100" />
            <div className="h-9 w-28 rounded-xl bg-gray-200" />
          </div>
        </div>
      </div>

      {/* 학습 목표 카드 스켈레톤 */}
      <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-6 space-y-2">
        <div className="h-4 w-32 rounded bg-blue-200/70" />
        <div className="h-5 w-3/4 rounded-lg bg-gray-200" />
      </div>

      {/* 수업 교안 뷰어 스켈레톤 */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div className="h-6 w-48 rounded-lg bg-gray-200" />
          <div className="h-8 w-28 rounded-xl bg-gray-100" />
        </div>
        <div className="space-y-3 py-2">
          <div className="h-4 w-full rounded bg-gray-100" />
          <div className="h-4 w-11/12 rounded bg-gray-100" />
          <div className="h-4 w-4/5 rounded bg-gray-100" />
          <div className="h-32 w-full rounded-xl bg-slate-50" />
        </div>
      </div>

      {/* 하단 질문 보드 스켈레톤 */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
        <div className="h-6 w-40 rounded-lg bg-gray-200" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="h-28 rounded-2xl bg-gray-50 border border-gray-100" />
          <div className="h-28 rounded-2xl bg-gray-50 border border-gray-100" />
        </div>
      </div>
    </div>
  );
}
