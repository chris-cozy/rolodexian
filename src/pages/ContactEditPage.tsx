import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ContactForm from "../components/ContactForm";
import { api } from "../lib/api";
import { emptyContact } from "../lib/contact";
import type { Contact } from "../types";

export default function ContactEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [contact, setContact] = useState<Contact | null>(id ? null : emptyContact());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setContact(emptyContact());
      return;
    }
    api
      .getContact(id)
      .then((result) => {
        setContact(result);
        setError(null);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load contact."));
  }, [id]);

  async function handleSubmit(nextContact: Contact) {
    const saved = id ? await api.updateContact(id, nextContact) : await api.createContact(nextContact);
    navigate(`/contacts/${saved.id}`);
  }

  return (
    <div className="page narrow-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">{id ? "Edit Contact" : "New Contact"}</p>
          <h1>{id ? contact?.name || "Contact" : "Create contact"}</h1>
        </div>
        <Link className="secondary-button" to={id ? `/contacts/${id}` : "/"}>
          <ArrowLeft size={17} />
          Back
        </Link>
      </header>

      {error ? <div className="form-error">{error}</div> : null}
      {!contact ? <div className="status-line">Loading contact</div> : null}
      {contact ? <ContactForm initialContact={contact} onSubmit={handleSubmit} submitLabel={id ? "Save changes" : "Create contact"} /> : null}
    </div>
  );
}
