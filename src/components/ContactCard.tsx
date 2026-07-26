import { CalendarDays, Edit3, Network, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { displayDate, displayRelationship } from "../lib/contact";
import type { Contact } from "../types";
import Avatar from "./Avatar";
import StrengthMeter from "./StrengthMeter";

interface ContactCardProps {
  contact: Contact;
  index: number;
}

export default function ContactCard({ contact, index }: ContactCardProps) {
  return (
    <article className="contact-card">
      <div className="card-record-line" aria-hidden="true">
        <span className="card-index">{String(index).padStart(2, "0")}</span>
        <span className="record-status">ACTIVE</span>
      </div>
      <Link to={`/contacts/${contact.id}`} className="contact-card-main">
        <div className="contact-avatar-frame">
          <Avatar contact={contact} size="lg" />
          <span aria-hidden="true" />
        </div>
        <div className="contact-card-copy">
          <h2 title={contact.name}>{contact.name}</h2>
          <p>{displayRelationship(contact)}</p>
          <div className="contact-card-meta">
            <div className="meta-line">
              <UserRound size={15} />
              <div>
                <small>Aliases</small>
                <strong>{contact.nicknames.length ? contact.nicknames.join(", ") : "—"}</strong>
              </div>
            </div>
            <div className="meta-line">
              <CalendarDays size={15} />
              <div>
                <small>Last contact</small>
                <strong>{displayDate(contact.lastInteractionDate)}</strong>
              </div>
            </div>
            <div className="meta-line">
              <Network size={15} />
              <div>
                <small>Social count</small>
                <strong>{String(contact.socialAccounts.length).padStart(2, "0")}</strong>
              </div>
            </div>
          </div>
        </div>
      </Link>
      <div className="contact-card-strength">
        <span>Relationship strength</span>
        <StrengthMeter value={contact.relationshipStrength} label="Relationship strength score" />
      </div>
      <div className="card-actions">
        <Link className="icon-button" to={`/contacts/${contact.id}/edit`} aria-label={`Edit ${contact.name}`} title="Edit">
          <Edit3 size={17} />
        </Link>
      </div>
    </article>
  );
}
