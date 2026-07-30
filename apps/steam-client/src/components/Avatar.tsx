import type { Contact } from "../types";
import placeholderProfileImage from "../../../../assets/no-pfp.jpg";

export default function Avatar({
  contact,
  size = "medium",
  className = ""
}: {
  contact: Pick<Contact, "name" | "profileImage">;
  size?: "small" | "medium" | "large";
  className?: string;
}) {
  return (
    <span className={`steam-avatar steam-avatar-${size} ${className}`} aria-label={contact.name}>
      <img src={contact.profileImage?.url || placeholderProfileImage} alt="" />
    </span>
  );
}
