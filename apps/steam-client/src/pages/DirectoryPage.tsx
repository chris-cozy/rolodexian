import { ChevronDown, Plus, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Avatar from "../components/Avatar";
import HealthBadge, { healthBand } from "../components/HealthBadge";
import { api } from "../lib/api";
import { displayDate, displayRelationship, relationshipOptions } from "../lib/contact";
import type { Contact } from "../types";

type SortMode = "name" | "health" | "recent" | "updated";
type GroupMode = "none" | "relationship" | "health";

function searchableText(contact: Contact) {
  return [
    contact.name,
    contact.nicknames,
    contact.profile?.descriptor,
    contact.relationshipType,
    contact.summary,
    contact.traits,
    contact.preferences,
    contact.customFields,
    contact.socialAccounts,
    contact.profile?.sections.filter((section) => section.type === "markdown").map((section) => section.content.markdown)
  ].flatMap((value) => typeof value === "object" ? JSON.stringify(value) : String(value || "")).join(" ").toLowerCase();
}

function dateValue(value?: string | null) {
  return value ? new Date(value).getTime() || 0 : 0;
}

export default function DirectoryPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const search = params.get("q") || "";
  const relationship = params.get("relationship") || "";
  const health = params.get("health") || "";
  const sort = (params.get("sort") || "updated") as SortMode;
  const group = (params.get("group") || "health") as GroupMode;

  useEffect(() => {
    api.listContacts()
      .then((items) => { setContacts(items); setError(null); })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load the library."))
      .finally(() => setLoading(false));
  }, []);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    setParams(next, { replace: true });
  }

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return contacts
      .filter((contact) => !query || searchableText(contact).includes(query))
      .filter((contact) => !relationship || displayRelationship(contact) === relationship || contact.relationshipType === relationship)
      .filter((contact) => !health || healthBand(contact.relationshipStrength) === health)
      .sort((left, right) => {
        if (sort === "name") return left.name.localeCompare(right.name);
        if (sort === "health") return right.relationshipStrength - left.relationshipStrength || left.name.localeCompare(right.name);
        if (sort === "recent") return dateValue(right.lastInteractionDate) - dateValue(left.lastInteractionDate);
        return dateValue(right.updatedAt) - dateValue(left.updatedAt);
      });
  }, [contacts, search, relationship, health, sort]);

  const groups = useMemo(() => {
    if (group === "none") return [["All people", visible]] as Array<[string, Contact[]]>;
    const map = new Map<string, Contact[]>();
    visible.forEach((contact) => {
      const key = group === "health"
        ? ({ strong: "Thriving", steady: "Steady", fragile: "Needs attention" } as const)[healthBand(contact.relationshipStrength)]
        : displayRelationship(contact);
      map.set(key, [...(map.get(key) || []), contact]);
    });
    return [...map.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [visible, group]);

  return (
    <div className="library-layout">
      <aside className="library-rail">
        <div className="library-home">
          <strong>PEOPLE HOME</strong>
          <span>{contacts.length} profiles</span>
        </div>
        <label className="rail-search">
          <Search size={15} />
          <input aria-label="Search people" value={search} onChange={(event) => setParam("q", event.target.value)} placeholder="Search library" />
        </label>
        <div className="rail-list" aria-label="People">
          {visible.map((contact) => (
            <Link key={contact.id} to={`/contacts/${contact.id}`}>
              <Avatar contact={contact} size="small" />
              <span>{contact.name}</span>
              <i className={`rail-health health-${healthBand(contact.relationshipStrength)}`} />
            </Link>
          ))}
          {!loading && !visible.length ? <p>No matching people</p> : null}
        </div>
        <Link className="rail-add" to="/contacts/new"><Plus size={15} /> Add a person</Link>
      </aside>

      <section className="library-content">
        <header className="library-hero">
          <div>
            <p>ROLODEXIAN LIBRARY</p>
            <h1>Your people, thoughtfully curated.</h1>
            <span>Browse relationships as a personal collection—dense, visual, and easy to revisit.</span>
          </div>
          <div className="hero-stat"><strong>{visible.length}</strong><span>visible profiles</span></div>
        </header>

        <div className="library-toolbar">
          <span><SlidersHorizontal size={15} /> Browse</span>
          <label>Relationship
            <select value={relationship} onChange={(event) => setParam("relationship", event.target.value)}>
              <option value="">All</option>
              {relationshipOptions.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
          <label>Health
            <select value={health} onChange={(event) => setParam("health", event.target.value)}>
              <option value="">All</option>
              <option value="strong">Thriving</option>
              <option value="steady">Steady</option>
              <option value="fragile">Needs attention</option>
            </select>
          </label>
          <label>Sort
            <select value={sort} onChange={(event) => setParam("sort", event.target.value)}>
              <option value="updated">Recently updated</option>
              <option value="name">Name</option>
              <option value="health">Health</option>
              <option value="recent">Latest interaction</option>
            </select>
          </label>
          <label>Group
            <select value={group} onChange={(event) => setParam("group", event.target.value)}>
              <option value="relationship">Relationship</option>
              <option value="health">Health</option>
              <option value="none">None</option>
            </select>
          </label>
        </div>

        {error ? <div className="steam-error">{error}</div> : null}
        {loading ? <div className="steam-loading">Loading people library…</div> : null}
        {!loading && !visible.length ? (
          <div className="steam-empty"><h2>No profiles found</h2><p>Adjust the browse controls or add a new person.</p></div>
        ) : null}

        <div className="profile-shelves">
          {groups.map(([label, items]) => (
            <section className="profile-shelf" key={label}>
              <header><ChevronDown size={17} /><h2>{label}</h2><span>{items.length}</span></header>
              <div className="profile-card-grid">
                {items.map((contact) => (
                  <Link className="profile-card" to={`/contacts/${contact.id}`} key={contact.id}>
                    <div className="profile-card-art">
                      {contact.profileImage?.url
                        ? <img src={contact.profileImage.url} alt="" />
                        : <Avatar contact={contact} size="large" />}
                      <HealthBadge value={contact.relationshipStrength} compact />
                    </div>
                    <div className="profile-card-copy">
                      <h3>{contact.name}</h3>
                      <p>{displayRelationship(contact)}</p>
                      <span>{contact.profile?.descriptor || `Last interaction ${displayDate(contact.lastInteractionDate)}`}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}
