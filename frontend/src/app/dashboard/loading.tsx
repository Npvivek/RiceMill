export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-7xl animate-pulse" aria-label="Opening dashboard" role="status">
      <div className="h-4 w-28 rounded bg-amber-100 dark:bg-amber-900/40" />
      <div className="mt-3 h-9 w-64 rounded bg-amber-100 dark:bg-amber-900/40" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {["income", "expenses", "net", "transactions"].map((metric) => (
          <div key={metric} className="h-32 rounded-xl border border-amber-100 bg-white dark:border-amber-900/40 dark:bg-gray-900" />
        ))}
      </div>
      <div className="mt-6 h-72 rounded-xl border border-amber-100 bg-white dark:border-amber-900/40 dark:bg-gray-900" />
      <span className="sr-only">Opening dashboard</span>
    </div>
  );
}
