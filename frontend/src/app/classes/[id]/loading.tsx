export default function ClassDetailLoading() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-8 lg:px-12 space-y-6 animate-pulse">
      {/* 상단 네비게이션 & 헤더 스켈레톤 */}
      <div>
        <div className="h-4 w-36 rounded-md bg-gray-200 mb-4" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2.5">
            <div className="h-4 w-44 rounded-md bg-blue-100" />
            <div className="h-8 w-64 rounded-xl bg-gray-200" />
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="h-10 w-52 rounded-xl bg-indigo-100" />
            <div className="h-10 w-36 rounded-xl bg-blue-50" />
            <div className="h-10 w-36 rounded-xl bg-gray-100" />
          </div>
        </div>
      </div>

      {/* 탭 바 스켈레톤 */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-3">
        <div className="flex items-center gap-2">
          <div className="h-10 w-44 rounded-xl bg-gray-200" />
          <div className="h-10 w-48 rounded-xl bg-gray-100" />
        </div>
        <div className="h-10 w-44 rounded-xl bg-blue-50" />
      </div>

      {/* 본문 2열 그리드 스켈레톤 */}
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-3">
          {[1, 2, 3, 4].map((idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-3"
            >
              <div className="flex items-center gap-2">
                <div className="h-5 w-10 rounded-md bg-gray-100" />
                <div className="h-5 w-24 rounded-full bg-emerald-50" />
                <div className="h-5 w-28 rounded-full bg-indigo-50" />
              </div>
              <div className="h-6 w-2/3 rounded-lg bg-gray-200" />
              <div className="h-4 w-full rounded-md bg-gray-100" />
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <div className="h-6 w-36 rounded-lg bg-gray-200" />
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-3">
            <div className="h-16 w-full rounded-xl bg-indigo-50/70" />
            {[1, 2, 3].map((idx) => (
              <div key={idx} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-full bg-gray-200" />
                  <div className="space-y-1.5">
                    <div className="h-4 w-20 rounded bg-gray-200" />
                    <div className="h-3 w-24 rounded bg-gray-100" />
                  </div>
                </div>
                <div className="h-6 w-20 rounded-lg bg-gray-100" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
