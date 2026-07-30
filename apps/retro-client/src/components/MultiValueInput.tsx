import { KeyboardEvent, useId, useState } from "react";
import { X } from "lucide-react";

interface MultiValueInputProps {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
}

function appendUnique(values: string[], candidates: string[]) {
  const next = [...values];
  const known = new Set(values.map((value) => value.toLocaleLowerCase()));

  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    const normalized = trimmed.toLocaleLowerCase();
    if (!trimmed || known.has(normalized)) continue;
    known.add(normalized);
    next.push(trimmed);
  }

  return next;
}

export default function MultiValueInput({ label, values, onChange }: MultiValueInputProps) {
  const inputId = useId();
  const helpId = `${inputId}-help`;
  const [draft, setDraft] = useState("");

  function commit(rawValue = draft) {
    const next = appendUnique(values, rawValue.split(","));
    if (next.length !== values.length) onChange(next);
    setDraft("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commit();
      return;
    }

    if (event.key === "Backspace" && !draft && values.length) {
      event.preventDefault();
      onChange(values.slice(0, -1));
    }
  }

  function handleDraftChange(nextDraft: string) {
    if (!nextDraft.includes(",")) {
      setDraft(nextDraft);
      return;
    }

    const segments = nextDraft.split(",");
    const trailingDraft = segments.pop() || "";
    const next = appendUnique(values, segments);
    if (next.length !== values.length) onChange(next);
    setDraft(trailingDraft.replace(/^\s+/, ""));
  }

  function removeValue(index: number) {
    onChange(values.filter((_, valueIndex) => valueIndex !== index));
  }

  return (
    <div className="multi-value-field">
      <label htmlFor={inputId}>{label}</label>
      <div className="multi-value-control" onClick={(event) => event.currentTarget.querySelector("input")?.focus()}>
        {values.map((value, index) => (
          <span className="multi-value-chip" key={`${value}-${index}`}>
            {value}
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={(event) => {
                event.stopPropagation();
                removeValue(index);
              }}
              aria-label={`Remove ${label.toLowerCase()} value ${value}`}
            >
              <X size={12} aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          id={inputId}
          value={draft}
          onChange={(event) => handleDraftChange(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => commit()}
          aria-describedby={helpId}
          autoComplete="off"
        />
      </div>
      <small id={helpId}>Type a value, then press Enter or comma.</small>
    </div>
  );
}
