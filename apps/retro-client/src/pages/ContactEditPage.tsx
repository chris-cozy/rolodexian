import { ArrowLeft, CircleCheck, Database, Save, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Avatar from "../components/Avatar";
import ContactForm from "../components/ContactForm";
import { api } from "../lib/api";
import { emptyContact } from "../lib/contact";
import type { Contact } from "../types";

const formSections = [
  ["01", "Profile"],
  ["02", "Appearance"],
  ["03", "Social Accounts"],
  ["04", "Interactions"],
  ["05", "Preferences"],
  ["06", "Notes"]
] as const;

export default function ContactEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [contact, setContact] = useState<Contact | null>(id ? null : emptyContact());
  const [previewContact, setPreviewContact] = useState<Contact | null>(id ? null : emptyContact());
  const [error, setError] = useState<string | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState("Profile");

  useEffect(() => {
    if (!id) {
      const nextContact = emptyContact();
      setContact(nextContact);
      setPreviewContact(nextContact);
      return;
    }
    api
      .getContact(id)
      .then((result) => {
        setContact(result);
        setPreviewContact(result);
        setError(null);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load contact."));
  }, [id]);

  useEffect(() => {
    if (!contact) return;
    const workspace = document.querySelector<HTMLElement>(".workspace");
    if (!workspace) return;
    const scrollContainer = workspace;

    function syncActiveSection() {
      const workspaceRect = scrollContainer.getBoundingClientRect();
      const visibleTop = Math.max(workspaceRect.top, 0);
      const visibleBottom = Math.min(workspaceRect.bottom, window.innerHeight);
      const threshold = visibleTop + Math.max(0, visibleBottom - visibleTop) * 0.4;
      const atWorkspaceEnd =
        scrollContainer.scrollHeight > scrollContainer.clientHeight &&
        scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight - 2;

      let nextSection: (typeof formSections)[number][1] = formSections[0][1];
      for (const [, label] of formSections) {
        const section = document.getElementById(`form-${label.toLowerCase().replace(" ", "-")}`);
        if (section && section.getBoundingClientRect().top <= threshold) nextSection = label;
      }
      if (atWorkspaceEnd) nextSection = formSections[formSections.length - 1][1];
      setActiveSection(nextSection);
    }

    syncActiveSection();
    scrollContainer.addEventListener("scroll", syncActiveSection, { passive: true });
    window.addEventListener("scroll", syncActiveSection, { passive: true });
    window.addEventListener("resize", syncActiveSection);
    return () => {
      scrollContainer.removeEventListener("scroll", syncActiveSection);
      window.removeEventListener("scroll", syncActiveSection);
      window.removeEventListener("resize", syncActiveSection);
    };
  }, [contact]);

  const completion = useMemo(() => {
    if (!previewContact) return 0;
    const checks = [
      previewContact.name,
      previewContact.relationshipType,
      previewContact.summary,
      previewContact.nicknames.length,
      previewContact.traits.length,
      previewContact.socialAccounts.length
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [previewContact]);

  async function handleSubmit(nextContact: Contact) {
    const saved = id ? await api.updateContact(id, nextContact) : await api.createContact(nextContact);
    window.localStorage.removeItem(`rolodexian-draft:${id || "new"}`);
    navigate(`/contacts/${saved.id}`);
  }

  function saveDraft() {
    if (!previewContact) return;
    window.localStorage.setItem(`rolodexian-draft:${id || "new"}`, JSON.stringify(previewContact));
    setDraftSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
  }

  return (
    <div className="page editor-page">
      <header className="page-header legacy-editor-header">
        <div>
          <p className="eyebrow">{id ? `Editing // ${contact?.name || "Contact"}` : "New Personnel Record"}</p>
          <h1>Record Input Console</h1>
          <p className="page-subtitle">{id ? "Unsaved changes are held locally until commit" : "Initialize a new private personnel record"}</p>
        </div>
        <div className="header-command-stack">
          <span className="warning-chip">▲ Unsaved Changes</span>
          <Link className="secondary-button" to={id ? `/contacts/${id}` : "/"}>
            <ArrowLeft size={17} />
            Back
          </Link>
        </div>
      </header>

      {error ? <div className="form-error">{error}</div> : null}
      {!contact ? <div className="status-line">Loading contact</div> : null}
      {contact && previewContact ? (
        <>
          <div className="editor-console-layout">
            <aside className="editor-section-nav" aria-label="Record sections">
              {formSections.map(([number, label], index) => (
                <a
                  key={label}
                  href={`#form-${label.toLowerCase().replace(" ", "-")}`}
                  className={activeSection === label ? "active" : ""}
                  onClick={() => setActiveSection(label)}
                >
                  <strong>{number}</strong>
                  <span>{label}</span>
                  <small>{index === 0 ? "Identification & core info" : "Record subsystem"}</small>
                </a>
              ))}
            </aside>

            <div className="editor-center-stack">
              <header className="page-header editor-page-header">
                <div>
                  <h1>Record Input Console</h1>
                  <p className="eyebrow">{id ? `Editing // ${contact.name}` : "New Personnel Record"}</p>
                </div>
                <span className="warning-chip">▲ Unsaved Changes</span>
              </header>
              <div className="editor-form-column">
                <ContactForm
                  initialContact={contact}
                  onChange={setPreviewContact}
                  onSubmit={handleSubmit}
                  submitLabel={id ? "Commit record" : "Create record"}
                />
              </div>
            </div>

            <aside className="editor-diagnostics">
              <section className="rail-panel live-preview">
                <h2>Live Record Preview</h2>
                <div className="preview-identity">
                  <div className="preview-avatar"><Avatar contact={previewContact} size="md" /></div>
                  <div>
                    <strong>{previewContact.name || "Unnamed record"}</strong>
                    <span>{previewContact.relationshipType || "Unclassified"}</span>
                  </div>
                </div>
                <div className="completion-ring" style={{ "--completion": `${completion * 3.6}deg` } as CSSProperties}>
                  <strong>{completion}%</strong>
                  <span>Completion</span>
                </div>
              </section>
              <section className="rail-panel validation-panel">
                <h2>Validation // 05 Pass</h2>
                <p><CircleCheck size={14} /> Required fields populated</p>
                <p><CircleCheck size={14} /> Record format valid</p>
                <p><CircleCheck size={14} /> Relationship classified</p>
                <p><ShieldCheck size={14} /> Local encryption active</p>
                <p><Database size={14} /> Datastore connected</p>
              </section>
              <section className="rail-panel editor-telemetry">
                <h2>Record Telemetry</h2>
                <dl>
                  <div><dt>Social accounts</dt><dd>{String(previewContact.socialAccounts.length).padStart(2, "0")}</dd></div>
                  <div><dt>Interactions</dt><dd>{String(previewContact.interactions.length).padStart(2, "0")}</dd></div>
                  <div><dt>Traits</dt><dd>{String(previewContact.traits.length).padStart(2, "0")}</dd></div>
                  <div><dt>Strength</dt><dd>{previewContact.relationshipStrength}%</dd></div>
                </dl>
              </section>
              <section className="rail-panel editor-vector-preview">
                <h2>Relationship Vector // Preview</h2>
                <div className="mini-vector" aria-label="Relationship vector preview">
                  <svg
                    className="mini-vector-links"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <line x1="13" y1="18" x2="50" y2="50" />
                    <line x1="87" y1="18" x2="50" y2="50" />
                    <line x1="50" y1="84" x2="50" y2="50" />
                  </svg>
                  <span className="mini-vector-core">{previewContact.name ? previewContact.name.split(" ").map((part) => part[0]).join("").slice(0, 2) : "RX"}</span>
                  <span className="mini-vector-node node-a">Strength<strong>{previewContact.relationshipStrength}%</strong></span>
                  <span className="mini-vector-node node-b">Social<strong>{String(previewContact.socialAccounts.length).padStart(2, "0")}</strong></span>
                  <span className="mini-vector-node node-c">Events<strong>{String(previewContact.interactions.length).padStart(2, "0")}</strong></span>
                </div>
              </section>
            </aside>
          </div>
          <div className="editor-command-bar">
            <Link className="secondary-button" to={id ? `/contacts/${id}` : "/"}>
              <Trash2 size={16} />
              Discard
            </Link>
            <button className="secondary-button" type="button" onClick={saveDraft}>
              <Save size={16} />
              Save Draft
            </button>
            <span>Operator: <strong>User-01</strong></span>
            <span>Clearance: <strong>Level 3</strong></span>
            <span>{draftSavedAt ? `Draft: ${draftSavedAt}` : "Validation Ready"}</span>
            <button className="primary-button" type="submit" form="contact-editor-form">
              <Save size={17} />
              {id ? "Commit Record" : "Create Record"}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
