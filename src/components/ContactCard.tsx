import { CalendarDays, Edit3, Network, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { displayDate, displayRelationship } from "../lib/contact";
import type { Contact } from "../types";
import Avatar from "./Avatar";
import StrengthMeter from "./StrengthMeter";

interface ContactCardProps {
  contact: Contact;
}

export default function ContactCard({ contact }: ContactCardProps) {
  return (
    <article className="contact-card">
      <Link to={`/contacts/${contact.id}`} className="contact-card-main">
        <Avatar contact={contact} size="lg" />
        <div className="contact-card-copy">
          <h2>{contact.name}</h2>
          <p>{contact.nicknames.length ? contact.nicknames.join(", ") : displayRelationship(contact)}</p>
        </div>
      </Link>
      <div className="contact-card-meta">
        <div className="meta-line">
          <UserRound size={15} />
          <div>
            <small>Relationship</small>
            <strong>{displayRelationship(contact)}</strong>
          </div>
        </div>
        <div className="meta-line">
          <CalendarDays size={15} />
          <div>
            <small>Last interaction date</small>
            <strong>{displayDate(contact.lastInteractionDate)}</strong>
          </div>
        </div>
        <div className="meta-line">
          <Network size={15} />
          <div>
            <small>Social accounts</small>
            <strong>{contact.socialAccounts.length} socials</strong>
          </div>
        </div>
      </div>
      <div className="contact-card-strength">
        <span>Relationship strength score</span>
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
