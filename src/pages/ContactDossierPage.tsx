import { ArrowLeft, CalendarDays, Edit3, ImagePlus, Link2, Trash2, Upload, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Avatar from "../components/Avatar";
import StrengthMeter from "../components/StrengthMeter";
import { api } from "../lib/api";
import { displayDate, displayRelationship } from "../lib/contact";
import type { Contact, Relationship, UploadedImage } from "../types";
import { RelationshipSection } from "./ContactDetailPage";

export default function ContactDossierPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [contact, setContact] = useState<Contact | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showAllInteractions, setShowAllInteractions] = useState(false);
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
    setError(null);
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
      await api.uploadImage(id, formData);
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
    if (!contact?.id || !window.confirm(`Delete ${contact.name}?`)) return;
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
    return <div className="page">{error ? <div className="form-error">{error}</div> : <div className="status-line">Loading contact</div>}</div>;
  }

  const profileImage = contact.profileImage || contact.images.find((image) => image.kind === "profile") || null;
  const supportingImages = contact.images.filter((image) => image.id !== profileImage?.id);
  const recentImages = [profileImage, ...supportingImages].filter((image): image is UploadedImage => Boolean(image)).slice(0, 6);
  const vectorRelationships = relatedRelationships.slice(0, 3);
  const visibleInteractions = showAllInteractions ? contact.interactions : contact.interactions.slice(0, 4);
  const traits = [...new Set([...contact.traits, ...(contact.preferences.interests || [])])];
  const nameParts = contact.name.split(" ");

  return (
    <div className="page dossier-page">
      <input ref={profileInputRef} type="file" accept="image/*" hidden onChange={(event) => handleUpload(event.target.files?.[0], "profile")} />
      <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={(event) => handleUpload(event.target.files?.[0], "additional")} />

      <header className="detail-header dossier-titlebar">
        <div className="dossier-heading">
          <h1>Contact Dossier</h1>
          <strong>{contact.name}</strong>
        </div>
        <div className="record-stamp" aria-label="Record status">
          <span>Record ID: <b>{contact.id?.slice(0, 12).toUpperCase() || "PENDING"}</b></span>
          <em>● Active Record</em>
        </div>
      </header>

      {error ? <div className="form-error">{error}</div> : null}

      <div className="dossier-console">
        <aside className="dossier-ident console-panel">
          <h2>Identification Scan</h2>
          <div className="ident-scan-frame">
            {profileImage ? <img src={profileImage.url} alt={`${contact.name} identification scan`} /> : <Avatar contact={contact} size="lg" />}
            <span className="scan-overlay" aria-hidden="true" />
            <small className="scan-code" aria-hidden="true">ID // {contact.id?.slice(0, 8).toUpperCase()}</small>
          </div>
          <div className="ident-controls">
            <button className="secondary-button" disabled={uploading} onClick={() => profileInputRef.current?.click()}>
              <Upload size={15} />
              {profileImage ? "Update Scan" : "Add Scan"}
            </button>
            {profileImage ? (
              <button className="icon-button danger" onClick={() => deleteImage(profileImage.id)} aria-label="Delete profile image" title="Delete profile image">
                <X size={15} />
              </button>
            ) : null}
          </div>
          <dl className="ident-readout">
            <div><dt>Relationship Type</dt><dd>{displayRelationship(contact)}</dd></div>
            <div><dt>Alias(es)</dt><dd>{contact.nicknames.join(", ") || "None logged"}</dd></div>
          </dl>
          <div className="ident-strength">
            <span>Relationship Strength</span>
            <StrengthMeter value={contact.relationshipStrength} />
          </div>
          <dl className="ident-meta">
            <div><dt>Created</dt><dd>{displayDate(contact.createdAt?.slice(0, 10))}</dd></div>
            <div><dt>Last Updated</dt><dd>{displayDate(contact.updatedAt?.slice(0, 10))}</dd></div>
            <div><dt>Data Source</dt><dd>Internal Sync</dd></div>
            <div><dt>Clearance</dt><dd>Level 3</dd></div>
          </dl>
        </aside>

        <main className="dossier-core">
          <section className="console-panel dossier-summary">
            <h2>Summary</h2>
            <p>{contact.summary || "No summary."}</p>
            {contact.selfRelationshipNotes ? <p>{contact.selfRelationshipNotes}</p> : null}
            <div className="summary-telemetry">
              <span>Last Interaction<strong>{displayDate(contact.lastInteractionDate)}</strong></span>
              <span>Social Count<strong>{String(contact.socialAccounts.length).padStart(3, "0")}</strong></span>
            </div>
          </section>

          <section className="console-panel dossier-interactions">
            <div className="panel-title-row">
              <h2>Interaction Log</h2>
              {contact.interactions.length > 2 ? (
                <button className="secondary-button" type="button" onClick={() => setShowAllInteractions(current => !current)}>
                  {showAllInteractions ? "Condense" : "View All"}
                </button>
              ) : null}
            </div>
            {contact.interactions.length ? (
              <div className="timeline">
                {visibleInteractions.map((interaction) => (
                  <div className="timeline-item" key={interaction.id}>
                    <CalendarDays size={15} />
                    <div>
                      <span>{displayDate(interaction.occurredOn)}</span>
                      <strong>{interaction.title || "Interaction"}</strong>
                      {interaction.notes ? <p>{interaction.notes}</p> : null}
                      <em>USER-01</em>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="muted">No interaction events.</p>}
          </section>

          <section className="console-panel dossier-social">
            <h2>Social Accounts</h2>
            <div className="social-table" role="table" aria-label="Social accounts">
              <div className="social-table-head" role="row">
                <span>Platform</span><span>Handle</span><span>Status</span><span>Last Sync</span>
              </div>
              {contact.socialAccounts.slice(0, 4).map((account) => (
                <div className="social-table-row" role="row" key={account.id}>
                  <strong>{account.platform || "Social"}</strong>
                  {account.url ? (
                    <a href={account.url} target="_blank" rel="noreferrer" aria-label={`Open ${account.platform || "social"} profile`}>
                      {account.username || "Open profile"} <Link2 size={12} />
                    </a>
                  ) : <span>{account.username || "No handle"}</span>}
                  <span className="live-value">● Active</span>
                  <span>{displayDate(contact.updatedAt?.slice(0, 10))}</span>
                </div>
              ))}
              {!contact.socialAccounts.length ? <p className="muted">No social accounts.</p> : null}
            </div>
          </section>

          <section className="console-panel dossier-traits">
            <h2>Interests & Traits</h2>
            <TagList values={traits} />
          </section>

        </main>

        <aside className="dossier-intel">
          <section className="console-panel relationship-vector">
            <h2>Relationship Vector</h2>
            <div className="vector-map">
              <div className="vector-core">
                <span>{nameParts[0]}</span>
                <span>{nameParts.slice(1).join(" ")}</span>
              </div>
              {vectorRelationships.map((relationship, index) => {
                const name = relationship.sourceContactId === contact.id ? relationship.targetName : relationship.sourceName;
                const strength = relationship.relationshipStrength;
                const strengthClass = strength >= 75 ? "strong" : strength >= 40 ? "moderate" : "weak";
                return (
                  <div className={`vector-node vector-node-${index + 1} ${strengthClass}`} key={relationship.id}>
                    <i aria-hidden="true" />
                    <span>{name}<strong>{strength}%</strong></span>
                  </div>
                );
              })}
              {!vectorRelationships.length ? <span className="vector-empty">No relationship vectors</span> : null}
            </div>
          </section>

          <section className="console-panel dossier-images">
            <div className="panel-title-row">
              <h2>Recent Images</h2>
              <button className="secondary-button" disabled={uploading} onClick={() => imageInputRef.current?.click()}>
                <ImagePlus size={14} />
                Add
              </button>
            </div>
            <div className="recent-image-grid">
              {recentImages.map((image, index) => (
                <figure key={image.id}>
                  <img src={image.url} alt={`${contact.name} attachment ${index + 1}`} />
                  <button className="icon-button danger" onClick={() => deleteImage(image.id)} aria-label="Delete image" title="Delete image">
                    <X size={13} />
                  </button>
                </figure>
              ))}
              {Array.from({ length: Math.max(0, 6 - recentImages.length) }, (_, index) => <span key={`slot-${index}`} />)}
            </div>
          </section>

          <section className="console-panel dossier-fields">
            <h2>Custom Fields</h2>
            {Object.entries(contact.customFields).length ? (
              Object.entries(contact.customFields).slice(0, 4).map(([key, value]) => <Definition key={key} label={key} value={value} />)
            ) : <p className="muted">No custom fields.</p>}
            <Definition label="Birthdate" value={displayDate(contact.birthdate)} />
          </section>
        </aside>
      </div>

      <section className="console-panel dossier-record-controls" aria-labelledby="dossier-record-controls-title">
        <div className="dossier-controls-heading">
          <div>
            <span>Record Maintenance // Live</span>
            <h2 id="dossier-record-controls-title">Relationship & Full Record Controls</h2>
          </div>
          <strong>All modules expanded</strong>
        </div>
        <div className="dossier-controls-grid">
          <div className="dossier-relationship-controls">
            <RelationshipSection contact={contact} contacts={contacts} relationships={relatedRelationships} onChanged={loadDetail} />
          </div>
          <div className="dossier-full-record-grid">
            <section className="info-section">
              <h2>Appearance</h2>
              <Definition label="Race" value={contact.appearance.race} />
              <Definition label="Sex" value={contact.appearance.sex} />
              <Definition label="Details" value={contact.appearance.details} />
              <Definition label="Other descriptors" value={contact.appearance.descriptors} />
            </section>
            <section className="info-section">
              <h2>Preferences</h2>
              <Definition label="Favorite color" value={contact.preferences.favoriteColor} />
              <Definition label="Favorite foods" value={contact.preferences.favoriteFoods?.join(", ")} />
              <Definition label="Likes" value={contact.preferences.likes?.join(", ")} />
              <Definition label="Dislikes" value={contact.preferences.dislikes?.join(", ")} />
              <Definition label="Other" value={contact.preferences.other} />
            </section>
            <section className="info-section">
              <h2>Record Notes</h2>
              <Definition label="Important dates" value={contact.importantDates?.join(" · ")} />
              <Definition label="Relationship notes" value={contact.selfRelationshipNotes} />
              <Definition label="Aliases" value={contact.nicknames.join(", ")} />
              <Definition label="Birthdate" value={displayDate(contact.birthdate)} />
            </section>
          </div>
        </div>
      </section>

      <div className="dossier-command-bar">
        <Link className="secondary-button" to={`/contacts/${contact.id}/edit`}><Edit3 size={17} /> Edit Record</Link>
        <Link className="secondary-button" to="/"><ArrowLeft size={16} /> Return to Index</Link>
        <span className="bar-telemetry">Operator: <strong>User-01</strong></span>
        <span className="bar-telemetry">Clearance: <strong>Level 3</strong></span>
        <span className="bar-telemetry">Session: <strong>RXN-7A19-3F2B</strong></span>
        <button className="icon-button danger" onClick={deleteContact} aria-label={`Delete ${contact.name}`} title="Delete"><Trash2 size={17} /></button>
      </div>
    </div>
  );
}

function Definition({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return <div className="definition-row"><span>{label}</span><strong>{value}</strong></div>;
}

function TagList({ values }: { values: string[] }) {
  if (!values.length) return <p className="muted">No traits logged.</p>;
  return <div className="tag-list">{values.slice(0, 9).map((value) => <span key={value}>{value}</span>)}</div>;
}
