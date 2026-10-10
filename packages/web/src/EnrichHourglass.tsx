/** Animated hourglass for Cursor analysis in progress. */
export function EnrichHourglass({
  className = "",
  size = 16,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      className={`adrv-hourglass text-amber-300 ${className}`}
      width={size}
      height={size}
      viewBox="0 0 20 24"
      aria-hidden="true"
    >
      <path
        className="adrv-hourglass-frame"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
        d="M4.5 2.5h11L11.5 11v1l4 9.5h-11L9.5 12V11L4.5 2.5z"
      />
      <path
        className="adrv-hourglass-sand-top"
        fill="currentColor"
        d="M6.2 4.2h7.6L11 9.8H8.8L6.2 4.2z"
      />
      <path
        className="adrv-hourglass-sand-bottom"
        fill="currentColor"
        d="M8.6 14.2h2.8l3.1 5.3H5.5l3.1-5.3z"
      />
      <circle className="adrv-hourglass-drip" cx="10" cy="11.8" r="0.65" fill="currentColor" />
    </svg>
  );
}
