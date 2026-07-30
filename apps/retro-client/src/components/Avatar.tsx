import type { Contact } from "../types";
import { imageSrc } from "../lib/contact";
import placeholderProfileImage from "../../../../assets/no-pfp.jpg";

interface AvatarProps {
  contact?: Pick<Contact, "name" | "profileImage"> | null;
  imageUrl?: string | null;
  label?: string;
  size?: "sm" | "md" | "lg";
}

export default function Avatar({ contact, imageUrl, label, size = "md" }: AvatarProps) {
  const name = contact?.name || label || "Contact";
  const src = imageSrc(imageUrl || contact?.profileImage?.url) || placeholderProfileImage;

  return (
    <div className={`avatar avatar-${size}`} aria-label={name}>
      <img src={src} alt="" />
    </div>
  );
}
