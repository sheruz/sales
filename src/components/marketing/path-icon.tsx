/** Inline SVG path icon used by canvas boards (stroke icons). */
export function PathIcon({
  d,
  size = 24,
  className = "",
  stroke = "currentColor",
}: {
  d: string;
  size?: number;
  className?: string;
  stroke?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}
