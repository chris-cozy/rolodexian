interface StrengthMeterProps {
  value: number;
  label?: string;
}

export default function StrengthMeter({ value, label }: StrengthMeterProps) {
  const normalized = Math.max(0, Math.min(100, Math.round(value || 0)));
  return (
    <div className={`strength-meter ${normalized >= 75 ? "is-strong" : normalized >= 40 ? "is-moderate" : "is-weak"}`} aria-label={label || `Strength ${normalized}`}>
      <div className="strength-track">
        <span style={{ width: `${normalized}%` }} />
      </div>
      <strong>{normalized}%</strong>
    </div>
  );
}
