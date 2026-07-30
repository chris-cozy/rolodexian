import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CalendarDays,
  Camera,
  Check,
  GripVertical,
  ImagePlus,
  Link2,
  Plus,
  Save,
  Trash2,
  Upload,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Link, useNavigate, useParams } from "react-router-dom";
import remarkGfm from "remark-gfm";
import Avatar from "../components/Avatar";
import HealthBadge, { healthBand } from "../components/HealthBadge";
import ImportantDatesEditor from "../components/ImportantDatesEditor";
import MultiValueInput from "../components/MultiValueInput";
import { api } from "../lib/api";
import { displayDate, displayRelationship, relationshipOptions, sortImportantDates } from "../lib/contact";
import type {
  Contact,
  InteractionEvent,
  ProfileGalleryItem,
  ProfileSection,
  ProfileSectionType,
  Relationship,
  SocialAccount
} from "../types";

const sectionLabels: Record<ProfileSectionType, string> = {
  markdown: "Markdown Showcase",
  gallery: "Image Gallery",
  importantDates: "Important Dates",
  preferences: "Preferences",
  socialAccounts: "Social Accounts",
  interactions: "Interaction History"
};
const singletonTypes = new Set<ProfileSectionType>(["importantDates", "preferences", "socialAccounts", "interactions"]);
type RelationshipInput = {
  targetContactId: string;
  relationshipType: string;
  customRelationshipType?: string | null;
  relationshipStrength: number;
};

export default function ProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [contact, setContact] = useState<Contact | null>(null);
  const [draftContact, setDraftContact] = useState<Contact | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [customizing, setCustomizing] = useState(false);
  const [descriptor, setDescriptor] = useState("");
  const [sectionType, setSectionType] = useState<ProfileSectionType>("markdown");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const backgroundInput = useRef<HTMLInputElement>(null);
  const profileInput = useRef<HTMLInputElement>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [nextContact, nextContacts, nextRelationships] = await Promise.all([
        api.getContact(id),
        api.listContacts(),
        api.listRelationships()
      ]);
      setContact(nextContact);
      setDraftContact((current) => current?.id === nextContact.id ? current : nextContact);
      setContacts(nextContacts);
      setRelationships(nextRelationships);
      setDescriptor(nextContact.profile?.descriptor || "");
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load this profile.");
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const related = useMemo(() => {
    if (!contact?.id) return [];
    return relationships.filter((relationship) =>
      relationship.sourceContactId === contact.id || relationship.targetContactId === contact.id
    );
  }, [contact?.id, relationships]);
  const contactMap = useMemo(() => new Map(contacts.map((item) => [item.id, item])), [contacts]);

  async function saveDescriptor() {
    if (!contact?.id) return;
    setBusy(true);
    try {
      setContact(await api.updateProfile(contact.id, { descriptor }));
      setError(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save the descriptor.");
    } finally { setBusy(false); }
  }

  async function saveContactDraft() {
    if (!contact?.id || !draftContact) return;
    setBusy(true);
    try {
      const saved = await api.updateContact(contact.id, draftContact);
      setContact(saved);
      setDraftContact(saved);
      setContacts((current) => current.map((item) => item.id === saved.id ? saved : item));
      setError(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save this profile.");
      throw saveError;
    } finally {
      setBusy(false);
    }
  }

  async function toggleCustomization() {
    if (!customizing) {
      setDraftContact(contact);
      setCustomizing(true);
      return;
    }
    try {
      await saveContactDraft();
      await saveDescriptor();
      setCustomizing(false);
    } catch {
      // Leave customization open so the user can correct or retry the save.
    }
  }

  async function changeBackground(file?: File) {
    if (!contact?.id || !file) return;
    setBusy(true);
    try { setContact(await api.uploadBackground(contact.id, file)); setError(null); }
    catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : "Unable to upload the background."); }
    finally {
      setBusy(false);
      if (backgroundInput.current) backgroundInput.current.value = "";
    }
  }

  async function removeBackground() {
    if (!contact?.id) return;
    setBusy(true);
    try { setContact(await api.deleteBackground(contact.id)); }
    catch (removeError) { setError(removeError instanceof Error ? removeError.message : "Unable to remove the background."); }
    finally { setBusy(false); }
  }

  async function changeProfileImage(file?: File) {
    if (!contact?.id || !file) return;
    const formData = new FormData();
    formData.set("image", file);
    formData.set("kind", "profile");
    setBusy(true);
    try { setContact(await api.uploadImage(contact.id, formData)); setError(null); }
    catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : "Unable to upload the profile image."); }
    finally {
      setBusy(false);
      if (profileInput.current) profileInput.current.value = "";
    }
  }

  async function removeProfileImage() {
    const image = contact?.profileImage;
    if (!image) return;
    setBusy(true);
    try { await api.deleteImage(image.id); await load(); }
    catch (removeError) { setError(removeError instanceof Error ? removeError.message : "Unable to remove the profile image."); }
    finally { setBusy(false); }
  }

  async function addSection() {
    if (!contact?.id) return;
    setBusy(true);
    try {
      await api.createProfileSection(contact.id, {
        type: sectionType,
        title: sectionLabels[sectionType],
        content: sectionType === "markdown" ? { markdown: "Write something meaningful here…" } : {}
      });
      await load();
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : "Unable to add that showcase.");
    } finally { setBusy(false); }
  }

  async function commitSectionOrder(reordered: ProfileSection[], original: ProfileSection[]) {
    if (!contact?.id || !contact.profile) return;
    setContact({ ...contact, profile: { ...contact.profile, sections: reordered } });
    try {
      const sections = await api.reorderProfileSections(contact.id, reordered.map((section) => section.id));
      setContact((current) => current?.profile ? { ...current, profile: { ...current.profile, sections } } : current);
    } catch (reorderError) {
      setContact({ ...contact, profile: { ...contact.profile, sections: original } });
      setError(reorderError instanceof Error ? reorderError.message : "Unable to reorder showcases.");
    }
  }

  async function reorderSections(event: DragEndEvent) {
    if (!contact?.profile || event.over?.id === event.active.id) return;
    const oldIndex = contact.profile.sections.findIndex((section) => section.id === event.active.id);
    const newIndex = contact.profile.sections.findIndex((section) => section.id === event.over?.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const original = contact.profile.sections;
    const reordered = arrayMove(original, oldIndex, newIndex).map((section, position) => ({ ...section, position }));
    await commitSectionOrder(reordered, original);
  }

  async function moveSection(sectionId: string, offset: -1 | 1) {
    if (!contact?.profile) return;
    const original = contact.profile.sections;
    const oldIndex = original.findIndex((section) => section.id === sectionId);
    const newIndex = oldIndex + offset;
    if (oldIndex < 0 || newIndex < 0 || newIndex >= original.length) return;
    const reordered = arrayMove(original, oldIndex, newIndex).map((section, position) => ({ ...section, position }));
    await commitSectionOrder(reordered, original);
  }

  async function addRelationship(input: RelationshipInput) {
    if (!contact?.id) return;
    setBusy(true);
    try {
      const created = await api.createRelationship({
        sourceContactId: contact.id,
        ...input
      });
      setRelationships((current) => [created, ...current]);
      setError(null);
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : "Unable to add that relationship.");
      throw addError;
    } finally {
      setBusy(false);
    }
  }

  async function updateRelationship(relationship: Relationship, patch: Partial<Relationship>) {
    setBusy(true);
    try {
      const saved = await api.updateRelationship(relationship.id, { ...relationship, ...patch });
      setRelationships((current) => current.map((item) => item.id === saved.id ? saved : item));
      setError(null);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update that relationship.");
      throw updateError;
    } finally {
      setBusy(false);
    }
  }

  async function removeRelationship(relationship: Relationship) {
    setBusy(true);
    try {
      await api.deleteRelationship(relationship.id);
      setRelationships((current) => current.filter((item) => item.id !== relationship.id));
      setError(null);
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Unable to remove that relationship.");
      throw removeError;
    } finally {
      setBusy(false);
    }
  }

  async function deleteContact() {
    if (!contact?.id || !window.confirm(`Delete ${contact.name} and all associated media?`)) return;
    await api.deleteContact(contact.id);
    navigate("/");
  }

  if (!contact) {
    return <div className="steam-loading">{error || "Loading profile…"}</div>;
  }

  const sections = contact.profile?.sections || [];
  const activeContact = customizing && draftContact ? draftContact : contact;
  const availableTypes = (Object.keys(sectionLabels) as ProfileSectionType[]).filter((type) =>
    !singletonTypes.has(type) || !sections.some((section) => section.type === type)
  );
  const background = contact.profile?.backgroundImage?.url;

  return (
    <div className="profile-page" style={background ? { "--profile-background": `url("${background}")` } as React.CSSProperties : undefined}>
      <div className="profile-backdrop" aria-hidden="true" />
      <div className="profile-frame">
        <Link className="profile-back" to="/"><ArrowLeft size={16} /> Back to Library</Link>
        <header className="profile-identity glass-panel">
          <Avatar contact={activeContact} size="large" />
          <div className="profile-title">
            {customizing ? (
              <input
                className="identity-name-input"
                value={activeContact.name}
                onChange={(event) => setDraftContact({ ...activeContact, name: event.target.value })}
                aria-label="Name"
              />
            ) : <h1>{activeContact.name}</h1>}
            {customizing ? (
              <div className="descriptor-editor">
                <input maxLength={160} value={descriptor} onChange={(event) => setDescriptor(event.target.value)} placeholder="Add a short descriptor" />
              </div>
            ) : (
              <p>{contact.profile?.descriptor || displayRelationship(activeContact)}</p>
            )}
            {activeContact.nicknames.length ? <span>{activeContact.nicknames.join(" · ")}</span> : null}
          </div>
          <HealthBadge value={activeContact.relationshipStrength} />
          <div className="profile-actions">
            <button className={customizing ? "active" : ""} disabled={busy} onClick={toggleCustomization}>
              {customizing ? <Check size={15} /> : <Camera size={15} />}
              {customizing ? "Save & finish" : "Customize profile"}
            </button>
          </div>
        </header>

        {error ? <div className="steam-error">{error}</div> : null}

        {customizing ? (
          <section className="customize-bar glass-panel">
            <input ref={backgroundInput} hidden type="file" accept="image/*" onChange={(event) => changeBackground(event.target.files?.[0])} />
            <input ref={profileInput} hidden type="file" accept="image/*" onChange={(event) => changeProfileImage(event.target.files?.[0])} />
            <button disabled={busy} onClick={() => profileInput.current?.click()}><Camera size={15} /> {contact.profileImage ? "Replace portrait" : "Upload portrait"}</button>
            {contact.profileImage ? <button disabled={busy} onClick={removeProfileImage}><X size={15} /> Remove portrait</button> : null}
            <button disabled={busy} onClick={() => backgroundInput.current?.click()}><Upload size={15} /> {background ? "Replace background" : "Upload background"}</button>
            {background ? <button disabled={busy} onClick={removeBackground}><X size={15} /> Remove background</button> : null}
            <span className="customize-spacer" />
            <select value={sectionType} onChange={(event) => setSectionType(event.target.value as ProfileSectionType)}>
              {availableTypes.map((type) => <option value={type} key={type}>{sectionLabels[type]}</option>)}
            </select>
            <button disabled={busy || !availableTypes.length} onClick={addSection}><Plus size={15} /> Add showcase</button>
          </section>
        ) : null}

        <div className="profile-layout">
          <main className="showcase-column">
            {sections.length ? (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={reorderSections}>
                <SortableContext items={sections.map((section) => section.id)} strategy={verticalListSortingStrategy}>
                  {sections.map((section, index) => (
                    <SortableSection
                      key={section.id}
                      section={section}
                      contact={activeContact}
                      customizing={customizing}
                      canMoveUp={index > 0}
                      canMoveDown={index < sections.length - 1}
                      onMove={moveSection}
                      onContactChange={setDraftContact}
                      onSaveContact={saveContactDraft}
                      onChanged={load}
                      onError={setError}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            ) : (
              <section className="glass-panel empty-showcases">
                <h2>This profile is ready to be curated.</h2>
                <p>Choose Customize Profile to add notes, galleries, important dates, preferences, accounts, or interaction history.</p>
              </section>
            )}
          </main>

          <aside className="profile-sidebar">
            <SidebarSection title="Profile Details">
              {customizing ? (
                <InlineProfileDetails contact={activeContact} onChange={setDraftContact} onSave={saveContactDraft} busy={busy} />
              ) : (
                <>
                  <Definition label="Relationship" value={displayRelationship(activeContact)} />
                  <Definition label="Birthdate" value={displayDate(activeContact.birthdate)} />
                  <Definition label="Last interaction" value={displayDate(activeContact.lastInteractionDate)} />
                  {activeContact.traits.length ? <TagList values={activeContact.traits} /> : null}
                </>
              )}
            </SidebarSection>
            {(customizing || Object.values(activeContact.appearance).some(Boolean)) ? (
              <SidebarSection title="Appearance">
                {customizing ? <InlineAppearance contact={activeContact} onChange={setDraftContact} onSave={saveContactDraft} busy={busy} /> : (
                  <>
                    <Definition label="Race" value={activeContact.appearance.race} />
                    <Definition label="Sex" value={activeContact.appearance.sex} />
                    <Definition label="Details" value={activeContact.appearance.details} />
                    <Definition label="Descriptors" value={activeContact.appearance.descriptors} />
                  </>
                )}
              </SidebarSection>
            ) : null}
            {!customizing && Object.values(activeContact.preferences).some((value) => Array.isArray(value) ? value.length : Boolean(value)) ? (
              <SidebarSection title="Preferences">
                {activeContact.preferences.favoriteColors?.length ? <Definition label="Colors" value={activeContact.preferences.favoriteColors.join(", ")} /> : null}
                {activeContact.preferences.favoriteFoods?.length ? <Definition label="Foods" value={activeContact.preferences.favoriteFoods.join(", ")} /> : null}
                {activeContact.preferences.interests?.length ? <Definition label="Interests" value={activeContact.preferences.interests.join(", ")} /> : null}
                {activeContact.preferences.likes?.length ? <Definition label="Likes" value={activeContact.preferences.likes.join(", ")} /> : null}
                {activeContact.preferences.dislikes?.length ? <Definition label="Dislikes" value={activeContact.preferences.dislikes.join(", ")} /> : null}
                <Definition label="Other" value={activeContact.preferences.other} />
              </SidebarSection>
            ) : null}
            {(customizing || Object.keys(activeContact.customFields).length) ? (
              <SidebarSection title="Custom Fields">
                {customizing
                  ? <InlineCustomFields contact={activeContact} onChange={setDraftContact} onSave={saveContactDraft} busy={busy} />
                  : Object.entries(activeContact.customFields).map(([label, value]) => <Definition key={label} label={label} value={value} />)}
              </SidebarSection>
            ) : null}
            <SidebarSection title={`Relationships · ${related.length}`}>
              {customizing ? (
                <InlineRelationships
                  contact={activeContact}
                  contacts={contacts}
                  relationships={related}
                  busy={busy}
                  onAdd={addRelationship}
                  onUpdate={updateRelationship}
                  onRemove={removeRelationship}
                />
              ) : (
                <>
                  {related.map((relationship) => {
                    const relatedId = relationship.sourceContactId === activeContact.id ? relationship.targetContactId : relationship.sourceContactId;
                    const relatedContact = contactMap.get(relatedId);
                    if (!relatedContact) return null;
                    return (
                      <Link className="relationship-row" to={`/contacts/${relatedId}`} key={relationship.id}>
                        <Avatar contact={relatedContact} size="small" />
                        <span><strong>{relatedContact.name}</strong><small>{relationship.relationshipLabel}</small></span>
                        <b className={`health-${healthBand(relationship.relationshipStrength)}`}>{relationship.relationshipStrength}</b>
                      </Link>
                    );
                  })}
                  {!related.length ? <p className="muted">No connections recorded.</p> : null}
                </>
              )}
            </SidebarSection>
            {customizing ? (
              <button className="delete-profile" onClick={deleteContact}><Trash2 size={15} /> Delete profile</button>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}

function SortableSection({
  section,
  contact,
  customizing,
  canMoveUp,
  canMoveDown,
  onMove,
  onContactChange,
  onSaveContact,
  onChanged,
  onError
}: {
  section: ProfileSection;
  contact: Contact;
  customizing: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (sectionId: string, offset: -1 | 1) => Promise<void>;
  onContactChange: (contact: Contact) => void;
  onSaveContact: () => Promise<void>;
  onChanged: () => Promise<void>;
  onError: (message: string | null) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id, disabled: !customizing });
  const [title, setTitle] = useState(section.title);
  const [markdown, setMarkdown] = useState(section.content.markdown || "");
  const style = { transform: CSS.Transform.toString(transform), transition };

  useEffect(() => { setTitle(section.title); setMarkdown(section.content.markdown || ""); }, [section]);

  async function saveSection() {
    try {
      await Promise.all([
        api.updateProfileSection(section.id, { title, content: section.type === "markdown" ? { markdown } : section.content }),
        onSaveContact()
      ]);
      await onChanged();
    } catch (error) { onError(error instanceof Error ? error.message : "Unable to save the showcase."); }
  }

  async function removeSection() {
    if (!window.confirm(`Remove “${section.title}” from this profile? Underlying contact data and media will be kept.`)) return;
    try { await api.deleteProfileSection(section.id); await onChanged(); }
    catch (error) { onError(error instanceof Error ? error.message : "Unable to remove the showcase."); }
  }

  return (
    <section ref={setNodeRef} style={style} className={`profile-showcase glass-panel${isDragging ? " is-dragging" : ""}`}>
      <header className="showcase-header">
        {customizing ? <button className="drag-handle" aria-label={`Reorder ${section.title}`} {...attributes} {...listeners}><GripVertical size={18} /></button> : null}
        {customizing ? <input value={title} onChange={(event) => setTitle(event.target.value)} /> : <h2>{section.title}</h2>}
        {customizing ? (
          <div className="showcase-controls">
            <button disabled={!canMoveUp} onClick={() => onMove(section.id, -1)} aria-label={`Move ${section.title} up`} title="Move showcase up"><ArrowUp size={14} /></button>
            <button disabled={!canMoveDown} onClick={() => onMove(section.id, 1)} aria-label={`Move ${section.title} down`} title="Move showcase down"><ArrowDown size={14} /></button>
            <button onClick={saveSection}><Save size={14} /> Save</button>
            <button onClick={removeSection} aria-label={`Remove ${section.title}`}><Trash2 size={14} /></button>
          </div>
        ) : null}
      </header>
      <SectionContent
        section={{ ...section, title, content: { ...section.content, markdown } }}
        contact={contact}
        customizing={customizing}
        markdown={markdown}
        onMarkdown={setMarkdown}
        onContactChange={onContactChange}
        onChanged={onChanged}
        onError={onError}
      />
    </section>
  );
}

function SectionContent({
  section,
  contact,
  customizing,
  markdown,
  onMarkdown,
  onContactChange,
  onChanged,
  onError
}: {
  section: ProfileSection;
  contact: Contact;
  customizing: boolean;
  markdown: string;
  onMarkdown: (value: string) => void;
  onContactChange: (contact: Contact) => void;
  onChanged: () => Promise<void>;
  onError: (message: string | null) => void;
}) {
  if (section.type === "markdown") {
    return (
      <div className={`markdown-showcase${customizing ? " editing" : ""}`}>
        {customizing ? <textarea value={markdown} onChange={(event) => onMarkdown(event.target.value)} aria-label={`${section.title} Markdown`} /> : null}
        <div className="markdown-preview"><ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown></div>
      </div>
    );
  }
  if (section.type === "gallery") {
    return <Gallery section={section} customizing={customizing} onChanged={onChanged} onError={onError} />;
  }
  if (section.type === "importantDates") {
    if (customizing) {
      return (
        <div className="inline-record-editor">
          <ImportantDatesEditor
            values={contact.importantDates}
            onChange={(importantDates) => onContactChange({ ...contact, importantDates })}
          />
        </div>
      );
    }
    const dates = sortImportantDates(contact.importantDates);
    return dates.length ? <div className="date-grid">{dates.map((item, index) => (
      <article key={`${item.date}-${index}`}><CalendarDays size={17} /><span><strong>{item.description || "Important date"}</strong><small>{displayDate(item.date)}</small></span></article>
    ))}</div> : <ModuleEmpty label="No important dates recorded." />;
  }
  if (section.type === "preferences") {
    if (customizing) {
      return <InlinePreferences contact={contact} onChange={onContactChange} />;
    }
    const entries = [
      ["Favorite colors", contact.preferences.favoriteColors],
      ["Favorite foods", contact.preferences.favoriteFoods],
      ["Interests", contact.preferences.interests],
      ["Likes", contact.preferences.likes],
      ["Dislikes", contact.preferences.dislikes],
      ["Other", contact.preferences.other ? [contact.preferences.other] : []]
    ] as Array<[string, string[] | undefined]>;
    return entries.some(([, values]) => values?.length)
      ? <div className="preference-grid">{entries.filter(([, values]) => values?.length).map(([label, values]) => (
        <div key={label}><h3>{label}</h3><TagList values={values || []} /></div>
      ))}</div>
      : <ModuleEmpty label="No preferences recorded." />;
  }
  if (section.type === "socialAccounts") {
    if (customizing) {
      return <InlineSocialAccounts contact={contact} onChange={onContactChange} />;
    }
    return contact.socialAccounts.length ? <div className="account-list">{contact.socialAccounts.map((account) => (
      <article key={account.id}><span><strong>{account.platform || "Social"}</strong><small>{account.username || "No handle"}</small></span>
        {account.url ? <a href={account.url} target="_blank" rel="noreferrer"><Link2 size={15} /> Open</a> : null}</article>
    ))}</div> : <ModuleEmpty label="No social accounts recorded." />;
  }
  if (customizing) {
    return <InlineInteractions contact={contact} onChange={onContactChange} />;
  }
  return contact.interactions.length ? <div className="interaction-list">{contact.interactions.map((interaction) => (
    <article key={interaction.id}><time>{displayDate(interaction.occurredOn)}</time><span><strong>{interaction.title || "Interaction"}</strong>{interaction.notes ? <p>{interaction.notes}</p> : null}</span></article>
  ))}</div> : <ModuleEmpty label="No interactions recorded." />;
}

function InlinePreferences({ contact, onChange }: { contact: Contact; onChange: (contact: Contact) => void }) {
  const fields = [
    ["Favorite colors", "favoriteColors"],
    ["Favorite foods", "favoriteFoods"],
    ["Interests", "interests"],
    ["Likes", "likes"],
    ["Dislikes", "dislikes"]
  ] as const;
  return (
    <div className="inline-record-editor inline-preference-editor">
      {fields.map(([label, key]) => (
        <MultiValueInput
          key={key}
          label={label}
          values={contact.preferences[key] || []}
          onChange={(values) => onChange({
            ...contact,
            preferences: { ...contact.preferences, [key]: values }
          })}
        />
      ))}
      <label className="inline-field">
        Other preferences
        <textarea
          value={contact.preferences.other || ""}
          onChange={(event) => onChange({
            ...contact,
            preferences: { ...contact.preferences, other: event.target.value }
          })}
        />
      </label>
    </div>
  );
}

function InlineSocialAccounts({ contact, onChange }: { contact: Contact; onChange: (contact: Contact) => void }) {
  function update(index: number, patch: Partial<SocialAccount>) {
    onChange({
      ...contact,
      socialAccounts: contact.socialAccounts.map((account, accountIndex) =>
        accountIndex === index ? { ...account, ...patch } : account
      )
    });
  }
  function remove(index: number) {
    onChange({ ...contact, socialAccounts: contact.socialAccounts.filter((_, accountIndex) => accountIndex !== index) });
  }
  return (
    <div className="inline-record-editor">
      <div className="inline-editor-heading">
        <span>Accounts are saved with this showcase.</span>
        <button onClick={() => onChange({
          ...contact,
          socialAccounts: [...contact.socialAccounts, { platform: "", username: "", url: "", notes: "" }]
        })}><Plus size={14} /> Add account</button>
      </div>
      <div className="inline-editor-rows">
        {contact.socialAccounts.map((account, index) => (
          <div className="inline-editor-row social-editor-row" key={account.id || index}>
            <label>Platform<input value={account.platform || ""} onChange={(event) => update(index, { platform: event.target.value })} /></label>
            <label>Username<input value={account.username || ""} onChange={(event) => update(index, { username: event.target.value })} /></label>
            <label>URL<input type="url" value={account.url || ""} onChange={(event) => update(index, { url: event.target.value })} /></label>
            <label>Notes<input value={account.notes || ""} onChange={(event) => update(index, { notes: event.target.value })} /></label>
            <button className="inline-remove" onClick={() => remove(index)} aria-label={`Remove social account ${index + 1}`}><X size={15} /></button>
          </div>
        ))}
        {!contact.socialAccounts.length ? <p className="muted">No social accounts. Add one above.</p> : null}
      </div>
    </div>
  );
}

function InlineInteractions({ contact, onChange }: { contact: Contact; onChange: (contact: Contact) => void }) {
  function update(index: number, patch: Partial<InteractionEvent>) {
    onChange({
      ...contact,
      interactions: contact.interactions.map((interaction, interactionIndex) =>
        interactionIndex === index ? { ...interaction, ...patch } : interaction
      )
    });
  }
  function remove(index: number) {
    onChange({ ...contact, interactions: contact.interactions.filter((_, interactionIndex) => interactionIndex !== index) });
  }
  return (
    <div className="inline-record-editor">
      <div className="inline-editor-heading">
        <span>Add or revise interaction history without leaving the profile.</span>
        <button onClick={() => onChange({
          ...contact,
          interactions: [...contact.interactions, { title: "", occurredOn: "", notes: "" }]
        })}><Plus size={14} /> Add interaction</button>
      </div>
      <div className="inline-editor-rows">
        {contact.interactions.map((interaction, index) => (
          <div className="inline-editor-row interaction-editor-row" key={interaction.id || index}>
            <label>Date<input type="date" value={interaction.occurredOn || ""} onChange={(event) => update(index, { occurredOn: event.target.value })} /></label>
            <label>Title<input value={interaction.title || ""} onChange={(event) => update(index, { title: event.target.value })} /></label>
            <label>Notes<textarea value={interaction.notes || ""} onChange={(event) => update(index, { notes: event.target.value })} /></label>
            <button className="inline-remove" onClick={() => remove(index)} aria-label={`Remove interaction ${index + 1}`}><X size={15} /></button>
          </div>
        ))}
        {!contact.interactions.length ? <p className="muted">No interactions. Add one above.</p> : null}
      </div>
    </div>
  );
}

function Gallery({
  section,
  customizing,
  onChanged,
  onError
}: {
  section: ProfileSection;
  customizing: boolean;
  onChanged: () => Promise<void>;
  onError: (message: string | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    try { await api.uploadGalleryImages(section.id, [...files]); await onChanged(); }
    catch (error) { onError(error instanceof Error ? error.message : "Unable to upload gallery images."); }
    finally { if (input.current) input.current.value = ""; }
  }

  async function reorder(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id) return;
    const oldIndex = section.galleryItems.findIndex((item) => item.id === event.active.id);
    const newIndex = section.galleryItems.findIndex((item) => item.id === event.over?.id);
    if (oldIndex < 0 || newIndex < 0) return;
    try {
      const items = arrayMove(section.galleryItems, oldIndex, newIndex);
      await api.reorderGalleryItems(section.id, items.map((item) => item.id));
      await onChanged();
    } catch (error) { onError(error instanceof Error ? error.message : "Unable to reorder gallery images."); }
  }

  return (
    <div>
      {customizing ? (
        <div className="gallery-upload">
          <input ref={input} hidden multiple type="file" accept="image/*" onChange={(event) => upload(event.target.files)} />
          <button onClick={() => input.current?.click()}><ImagePlus size={15} /> Add images</button>
          <span>Choose one or more images. Captions are optional.</span>
        </div>
      ) : null}
      {section.galleryItems.length ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={reorder}>
          <SortableContext items={section.galleryItems.map((item) => item.id)} strategy={rectSortingStrategy}>
            <div className={`gallery-grid gallery-count-${Math.min(section.galleryItems.length, 5)}`}>
              {section.galleryItems.map((item) => (
                <GalleryTile key={item.id} item={item} customizing={customizing} onChanged={onChanged} onError={onError} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : <p className="module-empty">No images in this gallery.</p>}
    </div>
  );
}

function GalleryTile({
  item,
  customizing,
  onChanged,
  onError
}: {
  item: ProfileGalleryItem;
  customizing: boolean;
  onChanged: () => Promise<void>;
  onError: (message: string | null) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id, disabled: !customizing });
  const [caption, setCaption] = useState(item.caption || "");
  const style = { transform: CSS.Transform.toString(transform), transition };
  useEffect(() => setCaption(item.caption || ""), [item.caption]);
  async function saveCaption() {
    try { await api.updateGalleryItem(item.id, { caption }); await onChanged(); }
    catch (error) { onError(error instanceof Error ? error.message : "Unable to save the caption."); }
  }
  async function remove() {
    try { await api.removeGalleryItem(item.id); await onChanged(); }
    catch (error) { onError(error instanceof Error ? error.message : "Unable to remove this image."); }
  }
  return (
    <figure ref={setNodeRef} style={style}>
      <img src={item.image.url} alt={item.caption || ""} />
      {customizing ? (
        <div className="gallery-edit">
          <button className="drag-handle" aria-label="Reorder image" {...attributes} {...listeners}><GripVertical size={15} /></button>
          <input value={caption} onChange={(event) => setCaption(event.target.value)} onBlur={saveCaption} placeholder="Optional caption" />
          <button onClick={remove} aria-label="Remove image from gallery"><X size={15} /></button>
        </div>
      ) : item.caption ? <figcaption>{item.caption}</figcaption> : null}
    </figure>
  );
}

function InlineProfileDetails({
  contact,
  onChange,
  onSave,
  busy
}: {
  contact: Contact;
  onChange: (contact: Contact) => void;
  onSave: () => Promise<void>;
  busy: boolean;
}) {
  return (
    <div className="inline-sidebar-editor">
      <MultiValueInput label="Nicknames" values={contact.nicknames} onChange={(nicknames) => onChange({ ...contact, nicknames })} />
      <label>Relationship
        <select value={contact.relationshipType} onChange={(event) => onChange({ ...contact, relationshipType: event.target.value })}>
          {relationshipOptions.map((option) => <option key={option}>{option}</option>)}
        </select>
      </label>
      {contact.relationshipType === "Custom" ? (
        <label>Custom relationship
          <input value={contact.customRelationshipType || ""} onChange={(event) => onChange({ ...contact, customRelationshipType: event.target.value })} />
        </label>
      ) : null}
      <label>Birthdate
        <input type="date" value={contact.birthdate || ""} onChange={(event) => onChange({ ...contact, birthdate: event.target.value })} />
      </label>
      <label className="inline-health-field">Relationship health <strong>{contact.relationshipStrength}</strong>
        <input type="range" min="0" max="100" value={contact.relationshipStrength} onChange={(event) => onChange({ ...contact, relationshipStrength: Number(event.target.value) })} />
      </label>
      <MultiValueInput label="Traits" values={contact.traits} onChange={(traits) => onChange({ ...contact, traits })} />
      <label>Relationship notes
        <textarea value={contact.selfRelationshipNotes || ""} onChange={(event) => onChange({ ...contact, selfRelationshipNotes: event.target.value })} />
      </label>
      <button className="inline-save" disabled={busy} onClick={onSave}><Save size={14} /> Save details</button>
    </div>
  );
}

function InlineAppearance({
  contact,
  onChange,
  onSave,
  busy
}: {
  contact: Contact;
  onChange: (contact: Contact) => void;
  onSave: () => Promise<void>;
  busy: boolean;
}) {
  const fields = [
    ["Race", "race"],
    ["Sex", "sex"],
    ["Details", "details"],
    ["Descriptors", "descriptors"]
  ] as const;
  return (
    <div className="inline-sidebar-editor">
      {fields.map(([label, key]) => (
        <label key={key}>{label}
          {key === "details" || key === "descriptors" ? (
            <textarea
              value={contact.appearance[key] || ""}
              onChange={(event) => onChange({ ...contact, appearance: { ...contact.appearance, [key]: event.target.value } })}
            />
          ) : (
            <input
              value={contact.appearance[key] || ""}
              onChange={(event) => onChange({ ...contact, appearance: { ...contact.appearance, [key]: event.target.value } })}
            />
          )}
        </label>
      ))}
      <button className="inline-save" disabled={busy} onClick={onSave}><Save size={14} /> Save appearance</button>
    </div>
  );
}

function InlineCustomFields({
  contact,
  onChange,
  onSave,
  busy
}: {
  contact: Contact;
  onChange: (contact: Contact) => void;
  onSave: () => Promise<void>;
  busy: boolean;
}) {
  const entries = Object.entries(contact.customFields);
  function replace(index: number, nextLabel: string, nextValue: string) {
    const next = entries.reduce<Record<string, string>>((result, [label, value], entryIndex) => {
      const key = entryIndex === index ? nextLabel : label;
      if (key.trim()) result[key] = entryIndex === index ? nextValue : value;
      return result;
    }, {});
    onChange({ ...contact, customFields: next });
  }
  function remove(index: number) {
    onChange({
      ...contact,
      customFields: entries.reduce<Record<string, string>>((result, [label, value], entryIndex) => {
        if (entryIndex !== index) result[label] = value;
        return result;
      }, {})
    });
  }
  function add() {
    let label = "New field";
    let suffix = 2;
    while (Object.prototype.hasOwnProperty.call(contact.customFields, label)) {
      label = `New field ${suffix++}`;
    }
    onChange({ ...contact, customFields: { ...contact.customFields, [label]: "" } });
  }
  return (
    <div className="inline-sidebar-editor custom-field-editor">
      {entries.map(([label, value], index) => (
        <div className="custom-field-row" key={`${label}-${index}`}>
          <input aria-label={`Custom field ${index + 1} label`} value={label} onChange={(event) => replace(index, event.target.value, value)} />
          <input aria-label={`Custom field ${index + 1} value`} value={value} onChange={(event) => replace(index, label, event.target.value)} />
          <button onClick={() => remove(index)} aria-label={`Remove custom field ${label}`}><X size={13} /></button>
        </div>
      ))}
      <button className="inline-add" onClick={add}><Plus size={13} /> Add field</button>
      <button className="inline-save" disabled={busy} onClick={onSave}><Save size={14} /> Save custom fields</button>
    </div>
  );
}

function InlineRelationships({
  contact,
  contacts,
  relationships,
  busy,
  onAdd,
  onUpdate,
  onRemove
}: {
  contact: Contact;
  contacts: Contact[];
  relationships: Relationship[];
  busy: boolean;
  onAdd: (input: RelationshipInput) => Promise<void>;
  onUpdate: (relationship: Relationship, patch: Partial<Relationship>) => Promise<void>;
  onRemove: (relationship: Relationship) => Promise<void>;
}) {
  const [targetContactId, setTargetContactId] = useState("");
  const [relationshipType, setRelationshipType] = useState("Friend");
  const [customRelationshipType, setCustomRelationshipType] = useState("");
  const [relationshipStrength, setRelationshipStrength] = useState(50);
  const connectedIds = useMemo(() => new Set(relationships.map((relationship) =>
    relationship.sourceContactId === contact.id ? relationship.targetContactId : relationship.sourceContactId
  )), [contact.id, relationships]);
  const availableContacts = contacts.filter((item) => item.id && item.id !== contact.id && !connectedIds.has(item.id));

  async function add() {
    if (!targetContactId) return;
    try {
      await onAdd({
        targetContactId,
        relationshipType,
        customRelationshipType: relationshipType === "Custom" ? customRelationshipType : null,
        relationshipStrength
      });
      setTargetContactId("");
      setRelationshipType("Friend");
      setCustomRelationshipType("");
      setRelationshipStrength(50);
    } catch {
      // The parent surfaces the API error above the profile.
    }
  }

  return (
    <div className="relationship-editor">
      {relationships.map((relationship) => (
        <RelationshipEditorRow
          key={relationship.id}
          contact={contact}
          contacts={contacts}
          relationship={relationship}
          busy={busy}
          onUpdate={onUpdate}
          onRemove={onRemove}
        />
      ))}
      {!relationships.length ? <p className="muted">No connections recorded.</p> : null}
      {availableContacts.length ? (
        <div className="relationship-add-form">
          <strong>Add a connection</strong>
          <label>Person
            <select aria-label="Connect person" value={targetContactId} onChange={(event) => setTargetContactId(event.target.value)}>
              <option value="">Select a person</option>
              {availableContacts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label>Relationship
            <select aria-label="New relationship type" value={relationshipType} onChange={(event) => setRelationshipType(event.target.value)}>
              {relationshipOptions.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
          {relationshipType === "Custom" ? (
            <label>Custom relationship
              <input aria-label="New custom relationship" value={customRelationshipType} onChange={(event) => setCustomRelationshipType(event.target.value)} />
            </label>
          ) : null}
          <label className="inline-health-field">Relationship health <strong>{relationshipStrength}</strong>
            <input
              aria-label="New relationship health"
              type="range"
              min="0"
              max="100"
              value={relationshipStrength}
              onChange={(event) => setRelationshipStrength(Number(event.target.value))}
            />
          </label>
          <button className="inline-add" disabled={busy || !targetContactId} onClick={add}><Plus size={13} /> Add connection</button>
        </div>
      ) : (
        <p className="relationship-editor-note">Every other person is already connected.</p>
      )}
    </div>
  );
}

function RelationshipEditorRow({
  contact,
  contacts,
  relationship,
  busy,
  onUpdate,
  onRemove
}: {
  contact: Contact;
  contacts: Contact[];
  relationship: Relationship;
  busy: boolean;
  onUpdate: (relationship: Relationship, patch: Partial<Relationship>) => Promise<void>;
  onRemove: (relationship: Relationship) => Promise<void>;
}) {
  const relatedId = relationship.sourceContactId === contact.id ? relationship.targetContactId : relationship.sourceContactId;
  const relatedContact = contacts.find((item) => item.id === relatedId);
  const relatedName = relatedContact?.name || "Unknown person";
  const [relationshipType, setRelationshipType] = useState(relationship.relationshipType);
  const [customRelationshipType, setCustomRelationshipType] = useState(relationship.customRelationshipType || "");
  const [relationshipStrength, setRelationshipStrength] = useState(relationship.relationshipStrength);

  useEffect(() => {
    setRelationshipType(relationship.relationshipType);
    setCustomRelationshipType(relationship.customRelationshipType || "");
    setRelationshipStrength(relationship.relationshipStrength);
  }, [relationship]);

  async function save() {
    try {
      await onUpdate(relationship, {
        relationshipType,
        customRelationshipType: relationshipType === "Custom" ? customRelationshipType : null,
        relationshipStrength
      });
    } catch {
      // The parent surfaces the API error above the profile.
    }
  }

  async function remove() {
    if (!window.confirm(`Remove the connection with ${relatedName}?`)) return;
    try {
      await onRemove(relationship);
    } catch {
      // The parent surfaces the API error above the profile.
    }
  }

  return (
    <div className="relationship-editor-row">
      <div className="relationship-editor-person">
        {relatedContact ? <Avatar contact={relatedContact} size="small" /> : null}
        <strong>{relatedName}</strong>
      </div>
      <label>Relationship
        <select
          aria-label={`Relationship type with ${relatedName}`}
          value={relationshipType}
          onChange={(event) => setRelationshipType(event.target.value)}
        >
          {relationshipOptions.map((option) => <option key={option}>{option}</option>)}
        </select>
      </label>
      {relationshipType === "Custom" ? (
        <label>Custom relationship
          <input
            aria-label={`Custom relationship with ${relatedName}`}
            value={customRelationshipType}
            onChange={(event) => setCustomRelationshipType(event.target.value)}
          />
        </label>
      ) : null}
      <label className="inline-health-field">Relationship health <strong>{relationshipStrength}</strong>
        <input
          aria-label={`Relationship health with ${relatedName}`}
          type="range"
          min="0"
          max="100"
          value={relationshipStrength}
          onChange={(event) => setRelationshipStrength(Number(event.target.value))}
        />
      </label>
      <div className="relationship-editor-actions">
        <button className="inline-save" disabled={busy} onClick={save} aria-label={`Save relationship with ${relatedName}`}><Save size={13} /> Save</button>
        <button className="inline-remove" disabled={busy} onClick={remove} aria-label={`Remove relationship with ${relatedName}`}><Trash2 size={13} /></button>
      </div>
    </div>
  );
}

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="sidebar-panel glass-panel"><h2>{title}</h2>{children}</section>;
}

function Definition({ label, value }: { label: string; value?: string | null }) {
  if (!value || value === "Not recorded") return null;
  return <div className="sidebar-definition"><span>{label}</span><strong>{value}</strong></div>;
}

function TagList({ values }: { values: string[] }) {
  return <div className="steam-tags">{values.map((value) => <span key={value}>{value}</span>)}</div>;
}

function ModuleEmpty({ label }: { label: string }) {
  return <p className="module-empty">{label}</p>;
}
