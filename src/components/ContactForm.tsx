import { Plus, Save, Trash2 } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import {
  formatKeyValueLines,
  formatLines,
  formatList,
  parseKeyValueLines,
  parseLines,
  parseList,
  relationshipOptions
} from "../lib/contact";
import type { Contact, InteractionEvent, SocialAccount } from "../types";

interface ContactFormProps {
  initialContact: Contact;
  onSubmit: (contact: Contact) => Promise<void>;
  submitLabel: string;
}

const blankSocial: SocialAccount = { platform: "", username: "", url: "", notes: "" };
const blankInteraction: InteractionEvent = { title: "", occurredOn: "", notes: "" };

export default function ContactForm({ initialContact, onSubmit, submitLabel }: ContactFormProps) {
  const [contact, setContact] = useState<Contact>(initialContact);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const customFieldsText = useMemo(() => formatKeyValueLines(contact.customFields), [contact.customFields]);

  function patchContact(patch: Partial<Contact>) {
    setContact((current) => ({ ...current, ...patch }));
  }

  function patchAppearance(key: string, value: string) {
    setContact((current) => ({
      ...current,
      appearance: { ...current.appearance, [key]: value }
    }));
  }

  function patchPreferences(key: string, value: string | string[]) {
    setContact((current) => ({
      ...current,
      preferences: { ...current.preferences, [key]: value }
    }));
  }

  function updateSocial(index: number, patch: Partial<SocialAccount>) {
    setContact((current) => ({
      ...current,
      socialAccounts: current.socialAccounts.map((account, accountIndex) =>
        accountIndex === index ? { ...account, ...patch } : account
      )
    }));
  }

  function updateInteraction(index: number, patch: Partial<InteractionEvent>) {
    setContact((current) => ({
      ...current,
      interactions: current.interactions.map((event, eventIndex) =>
        eventIndex === index ? { ...event, ...patch } : event
      )
    }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit(contact);
    } catch (formError) {
      setError(formError instanceof Error ? formError.message : "Unable to save contact.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="editor-form" onSubmit={handleSubmit}>
      {error ? <div className="form-error">{error}</div> : null}

      <section className="form-section">
        <div className="section-heading">
          <h2>Profile</h2>
        </div>
        <div className="form-grid">
          <label>
            Name
            <input
              value={contact.name}
              onChange={(event) => patchContact({ name: event.target.value })}
              required
              autoFocus
            />
          </label>
          <label>
            Nicknames
            <input
              value={formatList(contact.nicknames)}
              onChange={(event) => patchContact({ nicknames: parseList(event.target.value) })}
            />
          </label>
          <label>
            Birthdate
            <input
              type="date"
              value={contact.birthdate || ""}
              onChange={(event) => patchContact({ birthdate: event.target.value })}
            />
          </label>
          <label>
            Relationship
            <select
              value={contact.relationshipType}
              onChange={(event) => patchContact({ relationshipType: event.target.value })}
            >
              {relationshipOptions.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          {contact.relationshipType === "Custom" ? (
            <label>
              Custom relationship
              <input
                value={contact.customRelationshipType || ""}
                onChange={(event) => patchContact({ customRelationshipType: event.target.value })}
              />
            </label>
          ) : null}
          <label>
            Last interaction
            <input
              type="date"
              value={contact.lastInteractionDate || ""}
              onChange={(event) => patchContact({ lastInteractionDate: event.target.value })}
            />
          </label>
        </div>
        <label className="slider-field">
          Relationship strength
          <span>{contact.relationshipStrength}</span>
          <input
            type="range"
            min="0"
            max="100"
            value={contact.relationshipStrength}
            onChange={(event) => patchContact({ relationshipStrength: Number(event.target.value) })}
          />
        </label>
        <label>
          Relationship notes
          <textarea
            value={contact.selfRelationshipNotes || ""}
            onChange={(event) => patchContact({ selfRelationshipNotes: event.target.value })}
          />
        </label>
      </section>

      <section className="form-section">
        <div className="section-heading">
          <h2>Appearance</h2>
        </div>
        <div className="form-grid">
          <label>
            Race
            <input value={contact.appearance.race || ""} onChange={(event) => patchAppearance("race", event.target.value)} />
          </label>
          <label>
            Sex
            <input value={contact.appearance.sex || ""} onChange={(event) => patchAppearance("sex", event.target.value)} />
          </label>
        </div>
        <label>
          General appearance
          <textarea value={contact.appearance.details || ""} onChange={(event) => patchAppearance("details", event.target.value)} />
        </label>
        <label>
          Other descriptors
          <textarea
            value={contact.appearance.descriptors || ""}
            onChange={(event) => patchAppearance("descriptors", event.target.value)}
          />
        </label>
      </section>

      <section className="form-section">
        <div className="section-heading">
          <h2>Social Accounts</h2>
          <button
            type="button"
            className="secondary-button"
            onClick={() => patchContact({ socialAccounts: [...contact.socialAccounts, { ...blankSocial }] })}
          >
            <Plus size={16} />
            Add
          </button>
        </div>
        <div className="stack-list">
          {contact.socialAccounts.map((account, index) => (
            <div className="editable-row" key={account.id || index}>
              <input
                placeholder="Platform"
                value={account.platform || ""}
                onChange={(event) => updateSocial(index, { platform: event.target.value })}
              />
              <input
                placeholder="Username"
                value={account.username || ""}
                onChange={(event) => updateSocial(index, { username: event.target.value })}
              />
              <input placeholder="URL" value={account.url || ""} onChange={(event) => updateSocial(index, { url: event.target.value })} />
              <input
                placeholder="Notes"
                value={account.notes || ""}
                onChange={(event) => updateSocial(index, { notes: event.target.value })}
              />
              <button
                type="button"
                className="icon-button danger"
                aria-label="Remove social account"
                title="Remove"
                onClick={() =>
                  patchContact({
                    socialAccounts: contact.socialAccounts.filter((_, accountIndex) => accountIndex !== index)
                  })
                }
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {!contact.socialAccounts.length ? <p className="muted">No social accounts.</p> : null}
        </div>
      </section>

      <section className="form-section">
        <div className="section-heading">
          <h2>Interactions</h2>
          <button
            type="button"
            className="secondary-button"
            onClick={() => patchContact({ interactions: [...contact.interactions, { ...blankInteraction }] })}
          >
            <Plus size={16} />
            Add
          </button>
        </div>
        <div className="stack-list">
          {contact.interactions.map((interaction, index) => (
            <div className="editable-row interaction-row" key={interaction.id || index}>
              <input
                placeholder="Event"
                value={interaction.title || ""}
                onChange={(event) => updateInteraction(index, { title: event.target.value })}
              />
              <input
                type="date"
                value={interaction.occurredOn || ""}
                onChange={(event) => updateInteraction(index, { occurredOn: event.target.value })}
              />
              <input
                placeholder="Notes"
                value={interaction.notes || ""}
                onChange={(event) => updateInteraction(index, { notes: event.target.value })}
              />
              <button
                type="button"
                className="icon-button danger"
                aria-label="Remove interaction"
                title="Remove"
                onClick={() =>
                  patchContact({
                    interactions: contact.interactions.filter((_, interactionIndex) => interactionIndex !== index)
                  })
                }
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {!contact.interactions.length ? <p className="muted">No interaction events.</p> : null}
        </div>
      </section>

      <section className="form-section">
        <div className="section-heading">
          <h2>Preferences</h2>
        </div>
        <div className="form-grid">
          <label>
            Favorite color
            <input
              value={contact.preferences.favoriteColor || ""}
              onChange={(event) => patchPreferences("favoriteColor", event.target.value)}
            />
          </label>
          <label>
            Favorite foods
            <input
              value={formatList(contact.preferences.favoriteFoods)}
              onChange={(event) => patchPreferences("favoriteFoods", parseList(event.target.value))}
            />
          </label>
          <label>
            Interests
            <input
              value={formatList(contact.preferences.interests)}
              onChange={(event) => patchPreferences("interests", parseList(event.target.value))}
            />
          </label>
          <label>
            Likes
            <input
              value={formatList(contact.preferences.likes)}
              onChange={(event) => patchPreferences("likes", parseList(event.target.value))}
            />
          </label>
          <label>
            Dislikes
            <input
              value={formatList(contact.preferences.dislikes)}
              onChange={(event) => patchPreferences("dislikes", parseList(event.target.value))}
            />
          </label>
        </div>
        <label>
          Other preferences
          <textarea value={contact.preferences.other || ""} onChange={(event) => patchPreferences("other", event.target.value)} />
        </label>
      </section>

      <section className="form-section">
        <div className="section-heading">
          <h2>Notes</h2>
        </div>
        <div className="form-grid">
          <label>
            Traits
            <input value={formatList(contact.traits)} onChange={(event) => patchContact({ traits: parseList(event.target.value) })} />
          </label>
        </div>
        <label>
          Important dates
          <textarea
            value={formatLines(contact.importantDates)}
            onChange={(event) => patchContact({ importantDates: parseLines(event.target.value) })}
          />
        </label>
        <label>
          Summary
          <textarea value={contact.summary || ""} onChange={(event) => patchContact({ summary: event.target.value })} />
        </label>
        <label>
          Custom fields
          <textarea value={customFieldsText} onChange={(event) => patchContact({ customFields: parseKeyValueLines(event.target.value) })} />
        </label>
      </section>

      <div className="sticky-actions">
        <button className="primary-button" type="submit" disabled={saving}>
          <Save size={17} />
          {saving ? "Saving" : submitLabel}
        </button>
      </div>
    </form>
  );
}
