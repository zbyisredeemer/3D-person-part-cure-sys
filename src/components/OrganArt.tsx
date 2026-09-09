import type { CSSProperties } from "react";

export function LungArt({
  className = "",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="lung-teal" x1="20" y1="20" x2="100" y2="110">
          <stop stopColor="#a8e0d5" />
          <stop offset="1" stopColor="#469c94" />
        </linearGradient>
      </defs>
      <path
        d="M53 33c-3-9-9-12-14-6C27 40 18 55 16 75c-3 23 17 26 32 16 4-3 6-7 6-14V42Z"
        fill="url(#lung-teal)"
      />
      <path
        d="M67 33c3-9 9-12 14-6 12 13 21 28 23 48 3 23-17 26-32 16-4-3-6-7-6-14V42Z"
        fill="url(#lung-teal)"
      />
      <path
        d="M57 15v30l-15 15m21-45v30l15 15"
        stroke="#e4c8b4"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="m45 56-5 22m2-17-10 5m10 3 7 7m25-20 5 22m-2-17 10 5m-10 3-7 7"
        stroke="#daefea"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M57 23h6m-6 5h6m-6 5h6m-6 5h6"
        stroke="#f4e7d8"
        strokeWidth="2"
      />
    </svg>
  );
}

export function HumanMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 42"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="16" cy="6" r="4" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M12 13h8l5 13M12 13 7 26m5-13v13l-2 13m10-26v13l2 13m-10-13h8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
