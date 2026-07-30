import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../lib/api";
import type { Contact } from "../types";
import DirectoryPage from "./DirectoryPage";

function contact(name: string, relationshipStrength: number, relationshipType: string): Contact {
  return {
    id: name.toLowerCase(),
    name,
    nicknames: [],
    relationshipType,
    relationshipStrength,
    importantDates: [],
    appearance: {},
    traits: [],
    preferences: {},
    customFields: {},
    socialAccounts: [],
    interactions: [],
    images: [],
    profile: {
      contactId: name.toLowerCase(),
      descriptor: `${name} descriptor`,
      sections: [],
      backgroundImage: null
    }
  };
}

afterEach(() => vi.restoreAllMocks());

describe("DirectoryPage", () => {
  it("filters the compact rail and card shelves from one search", async () => {
    vi.spyOn(api, "listContacts").mockResolvedValue([
      contact("Maya Chen", 91, "Friend"),
      contact("Theo Parker", 35, "Coworker")
    ]);
    const user = userEvent.setup();
    render(<MemoryRouter><DirectoryPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getAllByText("Maya Chen").length).toBeGreaterThan(0));
    await user.type(screen.getByLabelText("Search people"), "Theo");
    expect(screen.queryByRole("heading", { name: "Maya Chen" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Theo Parker" })).toBeInTheDocument();
  });
});
