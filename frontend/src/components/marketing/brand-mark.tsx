export function BrandMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M24 42V11" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M23.5 15.5C17 14.4 12.6 10.8 10.3 5.5c6.3-.2 11 3 13.2 10Z" fill="currentColor" opacity=".95" />
      <path d="M24.5 21.5c6.6-1 11.1-4.7 13.5-10-6.4-.2-11.2 3-13.5 10Z" fill="currentColor" opacity=".76" />
      <path d="M23.4 28c-5.6-.8-9.4-4-11.4-8.5 5.5-.1 9.4 2.5 11.4 8.5Z" fill="currentColor" opacity=".58" />
      <path d="M24.6 34.5c5.2-.8 8.8-3.7 10.7-8-5.1-.1-8.8 2.4-10.7 8Z" fill="currentColor" opacity=".42" />
      <path d="M18 42h12" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
