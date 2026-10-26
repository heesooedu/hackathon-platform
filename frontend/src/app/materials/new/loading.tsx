export default function StudioLoading() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-8 lg:px-12 space-y-6 animate-pulse">
      <div className="flex items-center justify-between border-b border-gray-200 pb-4">
        <div className="h-5 w-40 rounded-lg bg-gray-200" />
        <div className="flex items-center gap-2">
          <div className="h-9 w-28 rounded-xl bg-gray-100" />
          <div className="h-9 w-36 rounded-xl bg-blue-200" />
        </div>
      </div>

      <div className="rounded-3xl border border-gray-200 bg-white p-6 sm:p-10 shadow-xs space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gray-100" />
          <div className="h-10 w-96 max-w-full rounded-xl bg-gray-200" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="h-10 rounded-xl bg-gray-100" />
          <div className="h-10 rounded-xl bg-gray-100" />
          <div className="h-10 rounded-xl bg-gray-100" />
        </div>
        <div className="h-16 w-full rounded-2xl bg-blue-50/50" />
        <div className="space-y-3 pt-4">
          <div className="h-6 w-48 rounded bg-gray-200" />
          <div className="h-40 w-full rounded-2xl bg-slate-50" />
        </div>
      </div>
    </div>
  );
}
