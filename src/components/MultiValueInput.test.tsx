import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import MultiValueInput from "./MultiValueInput";

function Harness({ initialValues = [] }: { initialValues?: string[] }) {
  const [values, setValues] = useState(initialValues);
  return (
    <>
      <MultiValueInput label="Interests" values={values} onChange={setValues} />
      <output aria-label="values">{JSON.stringify(values)}</output>
    </>
  );
}

function values() {
  return JSON.parse(screen.getByLabelText("values").textContent || "[]") as string[];
}

describe("MultiValueInput", () => {
  it("commits multi-word and multiple values with Enter and comma", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole("textbox", { name: "Interests" });

    await user.type(input, "Clash Royale{Enter}");
    await user.type(input, "Board games,");

    expect(values()).toEqual(["Clash Royale", "Board games"]);
  });

  it("commits the current draft on blur", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole("textbox", { name: "Interests" });

    await user.type(input, "Film photography");
    await user.tab();

    expect(values()).toEqual(["Film photography"]);
  });

  it("parses comma-delimited pasted text", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole("textbox", { name: "Interests" });

    await user.click(input);
    await user.paste("Indie films, urban gardening, ceramics,");

    expect(values()).toEqual(["Indie films", "urban gardening", "ceramics"]);
  });

  it("removes chips with their button and Backspace", async () => {
    const user = userEvent.setup();
    render(<Harness initialValues={["Anime", "Environmental science"]} />);
    const input = screen.getByRole("textbox", { name: "Interests" });

    await user.click(screen.getByRole("button", { name: "Remove interests value Anime" }));
    expect(values()).toEqual(["Environmental science"]);

    await user.click(input);
    await user.keyboard("{Backspace}");
    expect(values()).toEqual([]);
  });

  it("ignores blank and case-insensitive duplicate values", async () => {
    const user = userEvent.setup();
    render(<Harness initialValues={["Clash Royale"]} />);
    const input = screen.getByRole("textbox", { name: "Interests" });

    await user.type(input, "  {Enter}");
    await user.type(input, "clash royale{Enter}");

    expect(values()).toEqual(["Clash Royale"]);
  });
});
