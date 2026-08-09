export default function Logo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none">
      <circle cx="16" cy="16" r="15" stroke="var(--accent)" strokeWidth="1.5" opacity="0.4" />
      <path
        d="M8 20V12l5 5 3-3 3 3 5-5v8"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
