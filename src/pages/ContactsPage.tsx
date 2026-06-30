import { Plus, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ContactCard from "../components/ContactCard";
import { relationshipOptions } from "../lib/contact";
import { api } from "../lib/api";
import type { Contact } from "../types";

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [relationshipType, setRelationshipType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    api
      .listContacts({ search, relationshipType })
      .then((results) => {
        if (!ignore) {
          setContacts(results);
          setError(null);
        }
      })
      .catch((loadError) => {
        if (!ignore) setError(loadError instanceof Error ? loadError.message : "Unable to load contacts.");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [search, relationshipType]);

  const relationshipCounts = useMemo(() => {
    return contacts.reduce<Record<string, number>>((result, contact) => {
      result[contact.relationshipType] = (result[contact.relationshipType] || 0) + 1;
      return result;
    }, {});
  }, [contacts]);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Contacts</p>
          <h1>People</h1>
        </div>
        <div className="page-header-actions">
          <label className="search-box">
            <Search size={18} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search contacts" />
          </label>
          <label className="filter-box">
            <SlidersHorizontal size={17} />
            <select value={relationshipType} onChange={(event) => setRelationshipType(event.target.value)}>
              <option value="">All relationships</option>
              {relationshipOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                  {relationshipCounts[option] ? ` (${relationshipCounts[option]})` : ""}
                </option>
              ))}
            </select>
          </label>
          <Link className="primary-button" to="/contacts/new">
            <Plus size={17} />
            Contact
          </Link>
        </div>
      </header>

      <div className="data-strip">
        <span>Visible Records: {contacts.length}</span>
        <span>Query: {search || "none"}</span>
        <span>Filter: {relationshipType || "all"}</span>
      </div>

      {error ? <div className="form-error">{error}</div> : null}
      {loading ? <div className="status-line">Loading contacts</div> : null}
      {!loading && !contacts.length ? (
        <div className="empty-state">
          <h2>No contacts found</h2>
        </div>
      ) : null}
      <div className="contact-grid">
        {contacts.map((contact) => (
          <ContactCard key={contact.id} contact={contact} />
        ))}
      </div>
    </div>
  );
}
