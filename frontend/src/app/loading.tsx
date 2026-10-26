export default function HomeLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8 space-y-8 animate-pulse">
      {/* 환영 헤더 카드 스켈레톤 */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-3">
            <div className="h-4 w-28 rounded-md bg-blue-100" />
            <div className="h-8 w-64 rounded-xl bg-gray-200" />
            <div className="h-4 w-80 max-w-full rounded-md bg-gray-100" />
          </div>
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-44 rounded-xl bg-indigo-100" />
            <div className="h-10 w-32 rounded-xl bg-blue-100" />
          </div>
        </div>
      </div>

      {/* 안내 배너 스켈레톤 */}
      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-6">
        <div className="space-y-2.5">
          <div className="h-5 w-48 rounded-lg bg-indigo-100" />
          <div className="h-6 w-96 max-w-full rounded-lg bg-gray-200" />
          <div className="h-4 w-full max-w-xl rounded-md bg-gray-100" />
        </div>
      </div>

      {/* 클래스 그리드 스켈레톤 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-6 w-48 rounded-lg bg-gray-200" />
          <div className="h-4 w-16 rounded-md bg-gray-100" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="flex flex-col justify-between rounded-2xl border border-gray-100 bg-white p-5 shadow-sm h-36"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-6 w-24 rounded-lg bg-blue-50" />
                  <div className="h-4 w-14 rounded-md bg-gray-100" />
                </div>
                <div className="h-5 w-40 rounded-lg bg-gray-200" />
              </div>
              <div className="pt-3 border-t border-gray-50 flex items-center justify-between">
                <div className="h-4 w-24 rounded-md bg-blue-50" />
                <div className="h-4 w-4 rounded-md bg-blue-50" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
