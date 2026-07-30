import { Plus, Save, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import Avatar from "./Avatar";
import {
  formatKeyValueLines,
  parseKeyValueLines,
  relationshipOptions
} from "../lib/contact";
import type { Contact, InteractionEvent, SocialAccount } from "../types";
import ImportantDatesEditor from "./ImportantDatesEditor";
import MultiValueInput from "./MultiValueInput";

interface ContactFormProps {
  initialContact: Contact;
  onSubmit: (contact: Contact) => Promise<void>;
  onChange?: (contact: Contact) => void;
  submitLabel: string;
}

const blankSocial: SocialAccount = { platform: "", username: "", url: "", notes: "" };
const blankInteraction: InteractionEvent = { title: "", occurredOn: "", notes: "" };

export default function ContactForm({ initialContact, onSubmit, onChange, submitLabel }: ContactFormProps) {
  const [contact, setContact] = useState<Contact>(initialContact);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const customFieldsText = useMemo(() => formatKeyValueLines(contact.customFields), [contact.customFields]);

  useEffect(() => {
    onChange?.(contact);
  }, [contact, onChange]);

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
    <form className="editor-form" id="contact-editor-form" onSubmit={handleSubmit}>
      {error ? <div className="form-error">{error}</div> : null}

      <section className="form-section" id="form-profile">
        <div className="section-heading">
          <h2>Profile</h2>
        </div>
        <div className="profile-section-layout">
          <div className="form-ident-scan" aria-hidden="true">
            <Avatar contact={contact} size="large" />
            <small>Identification Scan</small>
          </div>
          <div className="form-profile-fields">
            <div className="form-grid">
          <label>
            Name
            <input
              value={contact.name}
              onChange={(event) => patchContact({ name: event.target.value })}
              required
            />
          </label>
          <MultiValueInput
            label="Nicknames"
            values={contact.nicknames}
            onChange={(nicknames) => patchContact({ nicknames })}
          />
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
          </div>
        </div>
      </section>

      <section className="form-section" id="form-appearance">
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

      <section className="form-section" id="form-social-accounts">
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

      <section className="form-section" id="form-interactions">
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

      <section className="form-section" id="form-preferences">
        <div className="section-heading">
          <h2>Preferences</h2>
        </div>
        <div className="form-grid">
          <MultiValueInput
            label="Favorite Colors"
            values={contact.preferences.favoriteColors || []}
            onChange={(favoriteColors) => patchPreferences("favoriteColors", favoriteColors)}
          />
          <MultiValueInput
            label="Favorite foods"
            values={contact.preferences.favoriteFoods || []}
            onChange={(favoriteFoods) => patchPreferences("favoriteFoods", favoriteFoods)}
          />
          <MultiValueInput
            label="Interests"
            values={contact.preferences.interests || []}
            onChange={(interests) => patchPreferences("interests", interests)}
          />
          <MultiValueInput
            label="Likes"
            values={contact.preferences.likes || []}
            onChange={(likes) => patchPreferences("likes", likes)}
          />
          <MultiValueInput
            label="Dislikes"
            values={contact.preferences.dislikes || []}
            onChange={(dislikes) => patchPreferences("dislikes", dislikes)}
          />
        </div>
        <label>
          Other preferences
          <textarea value={contact.preferences.other || ""} onChange={(event) => patchPreferences("other", event.target.value)} />
        </label>
      </section>

      <section className="form-section" id="form-notes">
        <div className="section-heading">
          <h2>Notes</h2>
        </div>
        <div className="form-grid">
          <MultiValueInput
            label="Traits"
            values={contact.traits}
            onChange={(traits) => patchContact({ traits })}
          />
        </div>
        <ImportantDatesEditor
          values={contact.importantDates}
          onChange={(importantDates) => patchContact({ importantDates })}
        />
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
