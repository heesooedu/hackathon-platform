export default function MaterialsLoading() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-8 lg:px-12 space-y-6 animate-pulse">
      {/* 상단 헤더 스켈레톤 */}
      <div className="rounded-3xl border border-gray-200 bg-white p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2.5">
            <div className="h-5 w-36 rounded-lg bg-indigo-100" />
            <div className="h-8 w-72 rounded-xl bg-gray-200" />
            <div className="h-4 w-96 max-w-full rounded-md bg-gray-100" />
          </div>
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-40 rounded-xl bg-indigo-200" />
          </div>
        </div>
      </div>

      {/* 본문 12열 그리드 스켈레톤 */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-3 space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
            <div className="h-5 w-32 rounded bg-gray-200" />
            <div className="h-10 w-full rounded-xl bg-blue-100" />
            <div className="h-9 w-full rounded-xl bg-gray-100" />
            <div className="h-9 w-full rounded-xl bg-gray-100" />
          </div>
        </div>

        <div className="lg:col-span-9 space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 flex items-center justify-between">
            <div className="h-9 w-64 rounded-xl bg-gray-100" />
            <div className="h-9 w-48 rounded-xl bg-gray-100" />
          </div>
          {[1, 2].map((idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3"
            >
              <div className="h-6 w-48 rounded-lg bg-gray-200" />
              <div className="h-24 w-full rounded-2xl bg-slate-50" />
              <div className="h-24 w-full rounded-2xl bg-slate-50" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
