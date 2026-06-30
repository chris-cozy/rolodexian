import { ArrowLeft, CalendarDays, Edit3, ImagePlus, Link2, Plus, Save, Trash2, Upload, UsersRound, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Avatar from "../components/Avatar";
import StrengthMeter from "../components/StrengthMeter";
import { api } from "../lib/api";
import { displayDate, displayRelationship, relationshipOptions } from "../lib/contact";
import type { Contact, Relationship } from "../types";

export default function ContactDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [contact, setContact] = useState<Contact | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const profileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  async function loadDetail() {
    if (!id) return;
    const [nextContact, nextContacts, nextRelationships] = await Promise.all([
      api.getContact(id),
      api.listContacts(),
      api.listRelationships()
    ]);
    setContact(nextContact);
    setContacts(nextContacts);
    setRelationships(nextRelationships);
  }

  useEffect(() => {
    loadDetail().catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load contact."));
  }, [id]);

  async function handleUpload(file: File | undefined, kind: "profile" | "additional") {
    if (!id || !file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("image", file);
      formData.set("kind", kind);
      const updatedContact = await api.uploadImage(id, formData);
      setContact(updatedContact);
      await loadDetail();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unable to upload image.");
    } finally {
      setUploading(false);
      if (profileInputRef.current) profileInputRef.current.value = "";
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }

  async function deleteContact() {
    if (!contact?.id) return;
    if (!window.confirm(`Delete ${contact.name}?`)) return;
    await api.deleteContact(contact.id);
    navigate("/");
  }

  async function deleteImage(imageId: string) {
    if (!window.confirm("Delete this image?")) return;
    await api.deleteImage(imageId);
    await loadDetail();
  }

  const relatedRelationships = useMemo(() => {
    if (!contact?.id) return [];
    return relationships.filter((relationship) => relationship.sourceContactId === contact.id || relationship.targetContactId === contact.id);
  }, [contact?.id, relationships]);

  if (!contact) {
    return (
      <div className="page">
        {error ? <div className="form-error">{error}</div> : <div className="status-line">Loading contact</div>}
      </div>
    );
  }

  const profileImage = contact.profileImage || contact.images.find((image) => image.kind === "profile") || null;
  const supportingImages = contact.images.filter((image) => image.id !== profileImage?.id);

  return (
    <div className="page">
      <header className="detail-header">
        <div className="detail-identity">
          <Avatar contact={contact} size="lg" />
          <div>
            <Link className="back-link" to="/">
              <ArrowLeft size={16} />
              Contacts
            </Link>
            <h1>{contact.name}</h1>
            <p>{contact.nicknames.length ? contact.nicknames.join(", ") : displayRelationship(contact)}</p>
          </div>
        </div>
        <div className="detail-actions">
          <Link className="secondary-button" to={`/contacts/${contact.id}/edit`}>
            <Edit3 size={17} />
            Edit
          </Link>
          <button className="icon-button danger" onClick={deleteContact} aria-label={`Delete ${contact.name}`} title="Delete">
            <Trash2 size={17} />
          </button>
        </div>
      </header>

      {error ? <div className="form-error">{error}</div> : null}

      <section className="summary-band">
        <div>
          <span>Relationship</span>
          <strong>{displayRelationship(contact)}</strong>
        </div>
        <div>
          <span>Last interaction</span>
          <strong>{displayDate(contact.lastInteractionDate)}</strong>
        </div>
        <div>
          <span>Strength</span>
          <StrengthMeter value={contact.relationshipStrength} />
        </div>
        <div>
          <span>Birthdate</span>
          <strong>{displayDate(contact.birthdate)}</strong>
        </div>
      </section>

      <div className="data-strip">
        <span>Record: {contact.id?.slice(0, 8) || "pending"}</span>
        <span>Images: {contact.images.length}</span>
        <span>Social Handles: {contact.socialAccounts.length}</span>
        <span>Events: {contact.interactions.length}</span>
      </div>

      <div className="detail-layout">
        <div className="detail-main">
          <InfoSection title="Notes">
            <p className="body-copy">{contact.summary || "No summary."}</p>
            {contact.selfRelationshipNotes ? <p className="body-copy">{contact.selfRelationshipNotes}</p> : null}
            <TagList values={contact.traits} />
          </InfoSection>

          <InfoSection title="Social Accounts">
            {contact.socialAccounts.length ? (
              <div className="data-list">
                {contact.socialAccounts.map((account) => (
                  <div className="data-row" key={account.id}>
                    <div>
                      <strong>{account.platform || "Social"}</strong>
                      <span>{account.username || "No handle"}</span>
                      {account.notes ? <small>{account.notes}</small> : null}
                    </div>
                    {account.url ? (
                      <a className="icon-button" href={account.url} target="_blank" rel="noreferrer" aria-label="Open profile" title="Open">
                        <Link2 size={16} />
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">No social accounts.</p>
            )}
          </InfoSection>

          <InfoSection title="Interactions">
            {contact.interactions.length ? (
              <div className="timeline">
                {contact.interactions.map((interaction) => (
                  <div className="timeline-item" key={interaction.id}>
                    <CalendarDays size={16} />
                    <div>
                      <strong>{interaction.title || "Interaction"}</strong>
                      <span>{displayDate(interaction.occurredOn)}</span>
                      {interaction.notes ? <p>{interaction.notes}</p> : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">No interaction events.</p>
            )}
          </InfoSection>

          <RelationshipSection
            contact={contact}
            contacts={contacts}
            relationships={relatedRelationships}
            onChanged={loadDetail}
          />

          <div className="detail-info-row">
            <InfoSection title="Appearance">
              <Definition label="Race" value={contact.appearance.race} />
              <Definition label="Sex" value={contact.appearance.sex} />
              <Definition label="Details" value={contact.appearance.details} />
              <Definition label="Descriptors" value={contact.appearance.descriptors} />
            </InfoSection>

            <InfoSection title="Preferences">
              <Definition label="Favorite color" value={contact.preferences.favoriteColor} />
              <Definition label="Favorite foods" value={contact.preferences.favoriteFoods?.join(", ")} />
              <Definition label="Interests" value={contact.preferences.interests?.join(", ")} />
              <Definition label="Likes" value={contact.preferences.likes?.join(", ")} />
              <Definition label="Dislikes" value={contact.preferences.dislikes?.join(", ")} />
              <Definition label="Other" value={contact.preferences.other} />
            </InfoSection>
          </div>
        </div>

        <aside className="detail-side">
          <InfoSection title="Images">
            <div className="upload-actions">
              <input
                ref={profileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(event) => handleUpload(event.target.files?.[0], "profile")}
              />
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(event) => handleUpload(event.target.files?.[0], "additional")}
              />
              <button className="secondary-button" disabled={uploading} onClick={() => profileInputRef.current?.click()}>
                <Upload size={16} />
                {profileImage ? "Replace Profile" : "Profile"}
              </button>
              <button className="secondary-button" disabled={uploading} onClick={() => imageInputRef.current?.click()}>
                <ImagePlus size={16} />
                Image
              </button>
            </div>
            <div className="profile-image-panel">
              {profileImage ? (
                <figure className="image-tile profile-image-tile">
                  <img src={profileImage.url} alt="" />
                  <figcaption>Profile</figcaption>
                  <button className="icon-button danger" onClick={() => deleteImage(profileImage.id)} aria-label="Delete profile image" title="Delete">
                    <X size={15} />
                  </button>
                </figure>
              ) : (
                <div className="profile-image-placeholder">No profile image.</div>
              )}
            </div>
            <div className="supporting-images">
              <h3>Supporting images</h3>
              <div className="image-grid supporting-image-grid">
                {supportingImages.map((image) => (
                  <figure className="image-tile supporting-image-tile" key={image.id}>
                    <img src={image.url} alt="" />
                    <figcaption>Supporting</figcaption>
                    <button className="icon-button danger" onClick={() => deleteImage(image.id)} aria-label="Delete image" title="Delete">
                      <X size={15} />
                    </button>
                  </figure>
                ))}
              </div>
              {!supportingImages.length ? <p className="muted">No supporting images.</p> : null}
            </div>
          </InfoSection>

          <InfoSection title="Custom Fields">
            {Object.entries(contact.customFields).length ? (
              Object.entries(contact.customFields).map(([key, value]) => <Definition key={key} label={key} value={value} />)
            ) : (
              <p className="muted">No custom fields.</p>
            )}
            <TagList values={contact.importantDates} />
          </InfoSection>
        </aside>
      </div>
    </div>
  );
}

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="info-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Definition({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="definition-row">
      <span>{label}</span>
      <strong>{value || "Not set"}</strong>
    </div>
  );
}

function TagList({ values }: { values: string[] }) {
  if (!values.length) return null;
  return (
    <div className="tag-list">
      {values.map((value) => (
        <span key={value}>{value}</span>
      ))}
    </div>
  );
}

function RelationshipSection({
  contact,
  contacts,
  relationships,
  onChanged
}: {
  contact: Contact;
  contacts: Contact[];
  relationships: Relationship[];
  onChanged: () => Promise<void>;
}) {
  const otherContacts = contacts.filter((candidate) => candidate.id && candidate.id !== contact.id);
  const [draft, setDraft] = useState({
    targetContactId: otherContacts[0]?.id || "",
    relationshipType: "Friend",
    customRelationshipType: "",
    relationshipStrength: 50,
    notes: "",
    startDate: "",
    lastInteractionDate: ""
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!draft.targetContactId && otherContacts[0]?.id) {
      setDraft((current) => ({ ...current, targetContactId: otherContacts[0].id || "" }));
    }
  }, [draft.targetContactId, otherContacts]);

  useEffect(() => {
    if (!modalOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setModalOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalOpen]);

  async function createRelationship(event: FormEvent) {
    event.preventDefault();
    if (!contact.id) return;
    setError(null);
    try {
      await api.createRelationship({
        sourceContactId: contact.id,
        targetContactId: draft.targetContactId,
        relationshipType: draft.relationshipType,
        customRelationshipType: draft.customRelationshipType,
        relationshipStrength: draft.relationshipStrength,
        notes: draft.notes,
        startDate: draft.startDate,
        lastInteractionDate: draft.lastInteractionDate
      });
      setDraft({
        targetContactId: otherContacts[0]?.id || "",
        relationshipType: "Friend",
        customRelationshipType: "",
        relationshipStrength: 50,
        notes: "",
        startDate: "",
        lastInteractionDate: ""
      });
      setModalOpen(false);
      await onChanged();
    } catch (relationshipError) {
      setError(relationshipError instanceof Error ? relationshipError.message : "Unable to save relationship.");
    }
  }

  return (
    <InfoSection title="Relationships">
      {error && !modalOpen ? <div className="form-error">{error}</div> : null}
      <div className="section-toolbar">
        <button
          className="secondary-button"
          disabled={!otherContacts.length}
          onClick={() => {
            setError(null);
            setModalOpen(true);
          }}
        >
          <Plus size={16} />
          Relationship
        </button>
      </div>

      {modalOpen ? (
        <div className="modal-backdrop" onMouseDown={() => setModalOpen(false)}>
          <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="relationship-modal-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2 id="relationship-modal-title">Add relationship</h2>
              <button className="icon-button" onClick={() => setModalOpen(false)} aria-label="Close relationship modal" title="Close">
                <X size={16} />
              </button>
            </div>
            {error ? <div className="form-error">{error}</div> : null}
            <form className="relationship-modal-form" onSubmit={createRelationship}>
              <label>
                Contact
                <select
                  value={draft.targetContactId}
                  onChange={(event) => setDraft((current) => ({ ...current, targetContactId: event.target.value }))}
                  required
                >
                  <option value="">Select contact</option>
                  {otherContacts.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Relationship type
                <select
                  value={draft.relationshipType}
                  onChange={(event) => setDraft((current) => ({ ...current, relationshipType: event.target.value }))}
                >
                  {relationshipOptions.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </label>
              {draft.relationshipType === "Custom" ? (
                <label className="full-span">
                  Custom type
                  <input
                    value={draft.customRelationshipType}
                    onChange={(event) => setDraft((current) => ({ ...current, customRelationshipType: event.target.value }))}
                  />
                </label>
              ) : null}
              <label className="compact-slider full-span">
                <span>Strength {draft.relationshipStrength}</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={draft.relationshipStrength}
                  onChange={(event) => setDraft((current) => ({ ...current, relationshipStrength: Number(event.target.value) }))}
                />
              </label>
              <label>
                Start date
                <input
                  type="date"
                  value={draft.startDate}
                  onChange={(event) => setDraft((current) => ({ ...current, startDate: event.target.value }))}
                />
              </label>
              <label>
                Last interaction
                <input
                  type="date"
                  value={draft.lastInteractionDate}
                  onChange={(event) => setDraft((current) => ({ ...current, lastInteractionDate: event.target.value }))}
                />
              </label>
              <label className="full-span">
                Notes
                <input value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} />
              </label>
              <div className="modal-actions">
                <button className="secondary-button" type="button" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button className="primary-button" disabled={!otherContacts.length}>
                  <UsersRound size={16} />
                  Add
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <div className="relationship-list">
        {relationships.map((relationship) => (
          <RelationshipRow key={relationship.id} contact={contact} relationship={relationship} onChanged={onChanged} />
        ))}
        {!relationships.length ? <p className="muted">No contact relationships.</p> : null}
      </div>
    </InfoSection>
  );
}

function RelationshipRow({
  contact,
  relationship,
  onChanged
}: {
  contact: Contact;
  relationship: Relationship;
  onChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    relationshipType: relationship.relationshipType,
    customRelationshipType: relationship.customRelationshipType || "",
    relationshipStrength: relationship.relationshipStrength,
    notes: relationship.notes || "",
    startDate: relationship.startDate || "",
    lastInteractionDate: relationship.lastInteractionDate || ""
  });

  const otherName = relationship.sourceContactId === contact.id ? relationship.targetName : relationship.sourceName;

  async function save() {
    await api.updateRelationship(relationship.id, {
      sourceContactId: relationship.sourceContactId,
      targetContactId: relationship.targetContactId,
      ...draft
    });
    setEditing(false);
    await onChanged();
  }

  async function remove() {
    if (!window.confirm(`Delete relationship with ${otherName}?`)) return;
    await api.deleteRelationship(relationship.id);
    await onChanged();
  }

  if (editing) {
    return (
      <div className="relationship-row editing">
        <strong>{otherName}</strong>
        <select
          value={draft.relationshipType}
          onChange={(event) => setDraft((current) => ({ ...current, relationshipType: event.target.value }))}
        >
          {relationshipOptions.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
        {draft.relationshipType === "Custom" ? (
          <input
            value={draft.customRelationshipType}
            onChange={(event) => setDraft((current) => ({ ...current, customRelationshipType: event.target.value }))}
          />
        ) : null}
        <label className="compact-slider">
          <span>{draft.relationshipStrength}</span>
          <input
            type="range"
            min="0"
            max="100"
            value={draft.relationshipStrength}
            onChange={(event) => setDraft((current) => ({ ...current, relationshipStrength: Number(event.target.value) }))}
          />
        </label>
        <input type="date" value={draft.startDate} onChange={(event) => setDraft((current) => ({ ...current, startDate: event.target.value }))} />
        <input
          type="date"
          value={draft.lastInteractionDate}
          onChange={(event) => setDraft((current) => ({ ...current, lastInteractionDate: event.target.value }))}
        />
        <input value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} />
        <button className="icon-button" onClick={save} aria-label="Save relationship" title="Save">
          <Save size={16} />
        </button>
        <button className="icon-button" onClick={() => setEditing(false)} aria-label="Cancel" title="Cancel">
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="relationship-row">
      <div>
        <strong>{otherName}</strong>
        <span>{relationship.relationshipLabel}</span>
        {relationship.notes ? <small>{relationship.notes}</small> : null}
      </div>
      <StrengthMeter value={relationship.relationshipStrength} />
      <button className="icon-button" onClick={() => setEditing(true)} aria-label="Edit relationship" title="Edit">
        <Edit3 size={16} />
      </button>
      <button className="icon-button danger" onClick={remove} aria-label="Delete relationship" title="Delete">
        <Trash2 size={16} />
      </button>
    </div>
  );
}
