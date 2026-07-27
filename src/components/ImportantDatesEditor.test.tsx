import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { ImportantDate } from "../types";
import ImportantDatesEditor from "./ImportantDatesEditor";

function Harness({ initialValues = [] }: { initialValues?: ImportantDate[] }) {
  const [values, setValues] = useState(initialValues);
  return (
    <>
      <ImportantDatesEditor values={values} onChange={setValues} />
      <output aria-label="important date values">{JSON.stringify(values)}</output>
    </>
  );
}

function values() {
  return JSON.parse(screen.getByLabelText("important date values").textContent || "[]") as ImportantDate[];
}

describe("ImportantDatesEditor", () => {
  it("adds and edits a structured date row", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Add Important Date" }));
    await user.type(screen.getByLabelText("Important date 1"), "2026-11-03");
    await user.type(screen.getByLabelText("Important date 1 description"), "Birthday");

    expect(values()).toEqual([{ date: "2026-11-03", description: "Birthday" }]);
  });

  it("warns about an undated preserved entry and removes it accessibly", async () => {
    const user = userEvent.setup();
    render(<Harness initialValues={[{ date: "", description: "Legacy anniversary note" }]} />);

    expect(screen.getByText(/Date missing\./)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove important date 1" }));

    expect(values()).toEqual([]);
    expect(screen.getByText("No important dates.")).toBeInTheDocument();
  });

  it("allows date-only entries without a warning", () => {
    render(<Harness initialValues={[{ date: "2026-07-27", description: "" }]} />);
    expect(screen.queryByText(/Date missing\./)).not.toBeInTheDocument();
  });
});
