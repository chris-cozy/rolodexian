import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../lib/api";
import type { Contact, Relationship } from "../types";
import ProfilePage from "./ProfilePage";

function contact(id: string, name: string): Contact {
  return {
    id,
    name,
    nicknames: [],
    relationshipType: "Friend",
    relationshipStrength: 70,
    importantDates: [],
    appearance: {},
    traits: [],
    preferences: {},
    customFields: {},
    socialAccounts: [],
    interactions: [],
    images: [],
    profile: {
      contactId: id,
      descriptor: `${name} descriptor`,
      sections: [],
      backgroundImage: null
    }
  };
}

function relationship(): Relationship {
  return {
    id: "relationship-1",
    sourceContactId: "alice",
    targetContactId: "bob",
    sourceName: "Alice",
    targetName: "Bob",
    relationshipType: "Friend",
    relationshipLabel: "Friend",
    relationshipStrength: 61,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
}

afterEach(() => vi.restoreAllMocks());

describe("ProfilePage relationship customization", () => {
  it("updates health, adds a connection, and removes a connection inline", async () => {
    const alice = contact("alice", "Alice");
    const bob = contact("bob", "Bob");
    const carol = contact("carol", "Carol");
    const existing = relationship();
    const created: Relationship = {
      ...existing,
      id: "relationship-2",
      targetContactId: "carol",
      targetName: "Carol",
      relationshipStrength: 74
    };
    vi.spyOn(api, "getContact").mockResolvedValue(alice);
    vi.spyOn(api, "listContacts").mockResolvedValue([alice, bob, carol]);
    vi.spyOn(api, "listRelationships").mockResolvedValue([existing]);
    const update = vi.spyOn(api, "updateRelationship").mockImplementation(async (_id, input) => ({
      ...existing,
      ...input,
      relationshipLabel: input.relationshipType || existing.relationshipLabel
    }));
    const create = vi.spyOn(api, "createRelationship").mockResolvedValue(created);
    const remove = vi.spyOn(api, "deleteRelationship").mockResolvedValue();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/contacts/alice"]}>
        <Routes><Route path="/contacts/:id" element={<ProfilePage />} /></Routes>
      </MemoryRouter>
    );

    await screen.findByRole("heading", { name: "Alice" });
    await user.click(screen.getByRole("button", { name: "Customize profile" }));

    fireEvent.change(screen.getByLabelText("Relationship health with Bob"), { target: { value: "82" } });
    await user.click(screen.getByRole("button", { name: "Save relationship with Bob" }));
    await waitFor(() => expect(update).toHaveBeenCalledWith(
      "relationship-1",
      expect.objectContaining({
        sourceContactId: "alice",
        targetContactId: "bob",
        relationshipStrength: 82
      })
    ));

    await user.selectOptions(screen.getByLabelText("Connect person"), "carol");
    fireEvent.change(screen.getByLabelText("New relationship health"), { target: { value: "74" } });
    await user.click(screen.getByRole("button", { name: "Add connection" }));
    await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({
      sourceContactId: "alice",
      targetContactId: "carol",
      relationshipType: "Friend",
      relationshipStrength: 74
    })));

    await user.click(screen.getByRole("button", { name: "Remove relationship with Bob" }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith("relationship-1"));
    expect(screen.queryByLabelText("Relationship health with Bob")).not.toBeInTheDocument();
  });
});
