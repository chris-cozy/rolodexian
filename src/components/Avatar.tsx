import type { Contact } from "../types";
import { imageSrc, initials } from "../lib/contact";

interface AvatarProps {
  contact?: Pick<Contact, "name" | "profileImage"> | null;
  imageUrl?: string | null;
  label?: string;
  size?: "sm" | "md" | "lg";
}

export default function Avatar({ contact, imageUrl, label, size = "md" }: AvatarProps) {
  const name = contact?.name || label || "Contact";
  const src = imageSrc(imageUrl || contact?.profileImage?.url);

  return (
    <div className={`avatar avatar-${size}`} aria-label={name}>
      {src ? <img src={src} alt="" /> : <span>{initials(name)}</span>}
    </div>
  );
}
