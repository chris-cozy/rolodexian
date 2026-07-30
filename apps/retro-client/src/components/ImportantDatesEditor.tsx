import { Plus, Trash2 } from "lucide-react";
import type { ImportantDate } from "../types";

interface ImportantDatesEditorProps {
  values: ImportantDate[];
  onChange: (values: ImportantDate[]) => void;
}

const blankImportantDate: ImportantDate = { date: "", description: "" };

export default function ImportantDatesEditor({ values, onChange }: ImportantDatesEditorProps) {
  function update(index: number, patch: Partial<ImportantDate>) {
    onChange(values.map((value, valueIndex) => (valueIndex === index ? { ...value, ...patch } : value)));
  }

  function remove(index: number) {
    onChange(values.filter((_, valueIndex) => valueIndex !== index));
  }

  return (
    <div className="important-dates-editor">
      <div className="important-dates-heading">
        <div>
          <span className="field-label">Important Dates</span>
          <small>Add a calendar date and a short description for each event.</small>
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={() => onChange([...values, { ...blankImportantDate }])}
        >
          <Plus size={16} />
          Add Important Date
        </button>
      </div>
      <div className="important-date-rows">
        {values.map((value, index) => {
          const missingDate = !value.date && Boolean(value.description.trim());
          return (
            <div className="important-date-editor-row" key={index}>
              <label>
                <span>Date</span>
                <input
                  type="date"
                  aria-label={`Important date ${index + 1}`}
                  value={value.date}
                  onChange={(event) => update(index, { date: event.target.value })}
                />
              </label>
              <label className="important-date-description">
                <span>Description</span>
                <input
                  aria-label={`Important date ${index + 1} description`}
                  placeholder="Birthday, anniversary, milestone…"
                  value={value.description}
                  onChange={(event) => update(index, { description: event.target.value })}
                />
              </label>
              <button
                type="button"
                className="icon-button danger important-date-remove"
                aria-label={`Remove important date ${index + 1}`}
                title="Remove important date"
                onClick={() => remove(index)}
              >
                <Trash2 size={16} />
              </button>
              {missingDate ? (
                <p className="important-date-warning" role="status">
                  Date missing. This legacy entry is preserved, but add a date to place it chronologically.
                </p>
              ) : null}
            </div>
          );
        })}
        {!values.length ? <p className="muted">No important dates.</p> : null}
      </div>
    </div>
  );
}
