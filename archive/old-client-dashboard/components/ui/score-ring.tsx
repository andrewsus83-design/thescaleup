export function scoreColor(v: number): string {
  if (v < 40) return "var(--color-bad)";
  if (v < 70) return "var(--color-warn)";
  return "var(--color-coral)";
}

export function scoreLabel(v: number): string {
  if (v < 40) return "Kritis";
  if (v < 70) return "Perlu Kerja";
  return "Sehat";
}

export function ScoreRing({
  value,
  size = 116,
  stroke = 9,
}: {
  value: number;
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (value / 100) * c;
  const color = scoreColor(value);

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-line)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          style={{ filter: `drop-shadow(0 0 6px ${color}66)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-display text-[1.65rem] font-extrabold leading-none"
          style={{ color }}
        >
          {value}
        </span>
        <span className="mt-0.5 font-mono text-[0.58rem] tracking-wider text-slate-500">
          / 100
        </span>
      </div>
    </div>
  );
}
