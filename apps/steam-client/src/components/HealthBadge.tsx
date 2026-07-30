export function healthBand(value: number) {
  if (value >= 75) return "strong";
  if (value >= 40) return "steady";
  return "fragile";
}

export default function HealthBadge({ value, compact = false }: { value: number; compact?: boolean }) {
  return (
    <span className={`health-badge health-${healthBand(value)}${compact ? " health-compact" : ""}`}>
      {!compact ? <small>Relationship Health</small> : null}
      <strong>{value}</strong>
    </span>
  );
}
