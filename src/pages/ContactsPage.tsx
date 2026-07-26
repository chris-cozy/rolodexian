import { Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ContactCard from "../components/ContactCard";
import { relationshipOptions } from "../lib/contact";
import { api } from "../lib/api";
import type { Contact } from "../types";

export default function ContactsPage() {
  const pageSize = 6;
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [relationshipType, setRelationshipType] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
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

  useEffect(() => {
    setPageIndex(0);
  }, [search, relationshipType]);

  const relationshipCounts = useMemo(() => {
    return contacts.reduce<Record<string, number>>((result, contact) => {
      result[contact.relationshipType] = (result[contact.relationshipType] || 0) + 1;
      return result;
    }, {});
  }, [contacts]);

  const averageStrength = useMemo(() => {
    if (!contacts.length) return 0;
    return Math.round(contacts.reduce((total, contact) => total + contact.relationshipStrength, 0) / contacts.length);
  }, [contacts]);
  const strongestCount = contacts.filter((contact) => contact.relationshipStrength >= 85).length;
  const lowEngagementCount = contacts.filter((contact) => contact.relationshipStrength < 40).length;
  const maxRelationshipCount = Math.max(1, ...Object.values(relationshipCounts));

  const pageCount = Math.max(1, Math.ceil(contacts.length / pageSize));
  const safePageIndex = Math.min(pageIndex, pageCount - 1);
  const visibleContacts = contacts.slice(safePageIndex * pageSize, safePageIndex * pageSize + pageSize);

  return (
    <div className="page personnel-page">
      <div className="personnel-console">
        <aside className="personnel-rail" aria-label="Personnel filters and system summary">
          <section className="rail-panel">
            <h2>Search Records</h2>
            <label className="search-box">
              <Search size={18} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, alias, tag..." />
            </label>
          </section>

          <section className="rail-panel">
            <h2>Relationship Filters</h2>
            <div className="filter-readout">
              <button
                type="button"
                className={!relationshipType ? "active" : ""}
                onClick={() => setRelationshipType("")}
              >
                <span>All contacts</span>
                <strong>{String(contacts.length).padStart(2, "0")}</strong>
              </button>
              {relationshipOptions.slice(0, 7).map((option) => (
                <button
                  type="button"
                  key={option}
                  className={relationshipType === option ? "active" : ""}
                  onClick={() => setRelationshipType(relationshipType === option ? "" : option)}
                >
                  <span>{option}</span>
                  <strong>{String(relationshipCounts[option] || 0).padStart(2, "0")}</strong>
                </button>
              ))}
            </div>
          </section>

          <section className="rail-panel system-summary">
            <h2>System Summary</h2>
            <dl>
              <div>
                <dt>Total records</dt>
                <dd>{String(contacts.length).padStart(4, "0")}</dd>
              </div>
              <div>
                <dt>Active contacts</dt>
                <dd>{String(contacts.length - lowEngagementCount).padStart(4, "0")}</dd>
              </div>
              <div>
                <dt>Dormant contacts</dt>
                <dd>{String(lowEngagementCount).padStart(4, "0")}</dd>
              </div>
              <div>
                <dt>High priority</dt>
                <dd className="critical-readout">{String(strongestCount).padStart(4, "0")}</dd>
              </div>
              <div>
                <dt>Average strength</dt>
                <dd>{String(averageStrength).padStart(2, "0")}%</dd>
              </div>
            </dl>
            <div
              className="system-distribution"
              role="img"
              aria-label="Relationship distribution by category"
            >
              <span>Relationship Distribution</span>
              <div>
                {relationshipOptions.slice(0, 6).map((option) => (
                  <i key={option} title={`${option}: ${relationshipCounts[option] || 0}`}>
                    <b style={{ height: `${Math.max(8, ((relationshipCounts[option] || 0) / maxRelationshipCount) * 100)}%` }} />
                    <small>{option.slice(0, 3)}</small>
                  </i>
                ))}
              </div>
            </div>
            <p className="system-sync"><span>Data Sync</span><strong>LIVE ●</strong></p>
            <Link className="secondary-button rail-new-record" to="/contacts/new">
              <Plus size={15} />
              Initialize Record
            </Link>
          </section>
        </aside>

        <section className="personnel-main">
          <header className="page-header personnel-header">
            <div>
              <h1>Personnel Index</h1>
              <p className="eyebrow">Classification: Internal</p>
            </div>
            <div className="page-header-readout">
              <span>Visible Records</span>
              <strong>{String(visibleContacts.length).padStart(2, "0")}</strong>
            </div>
          </header>

          {error ? <div className="form-error">{error}</div> : null}
          {loading ? <div className="status-line">Loading contacts</div> : null}
          {!loading && !contacts.length ? (
            <div className="empty-state">
              <h2>No contacts found</h2>
              <Link className="secondary-button" to="/contacts/new">
                <Plus size={16} />
                Add first contact
              </Link>
            </div>
          ) : null}
          <div className="contact-grid">
            {visibleContacts.map((contact, index) => (
              <ContactCard key={contact.id} contact={contact} index={safePageIndex * pageSize + index + 1} />
            ))}
          </div>
          {pageCount > 1 ? (
            <nav className="personnel-pager" aria-label="Personnel record pages">
              <button type="button" className="secondary-button" disabled={safePageIndex === 0} onClick={() => setPageIndex((value) => Math.max(0, value - 1))}>
                Previous
              </button>
              <span>Page {safePageIndex + 1} / {pageCount}</span>
              <button type="button" className="secondary-button" disabled={safePageIndex >= pageCount - 1} onClick={() => setPageIndex((value) => Math.min(pageCount - 1, value + 1))}>
                Next
              </button>
            </nav>
          ) : null}
        </section>
      </div>
    </div>
  );
}
