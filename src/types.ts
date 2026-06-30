export interface SocialAccount {
  id?: string;
  contactId?: string;
  platform?: string | null;
  username?: string | null;
  url?: string | null;
  notes?: string | null;
}

export interface InteractionEvent {
  id?: string;
  contactId?: string;
  title?: string | null;
  occurredOn?: string | null;
  notes?: string | null;
}

export interface UploadedImage {
  id: string;
  contactId: string;
  filename: string;
  originalName?: string | null;
  mimeType?: string | null;
  size?: number | null;
  kind: "profile" | "additional";
  notes?: string | null;
  createdAt: string;
  url: string;
}

export interface Appearance {
  race?: string;
  sex?: string;
  details?: string;
  descriptors?: string;
}

export interface Preferences {
  favoriteColor?: string;
  favoriteFoods?: string[];
  interests?: string[];
  likes?: string[];
  dislikes?: string[];
  other?: string;
}

export interface Contact {
  id?: string;
  name: string;
  nicknames: string[];
  birthdate?: string | null;
  relationshipType: string;
  customRelationshipType?: string | null;
  relationshipStrength: number;
  lastInteractionDate?: string | null;
  selfRelationshipNotes?: string | null;
  importantDates: string[];
  appearance: Appearance;
  traits: string[];
  preferences: Preferences;
  summary?: string | null;
  customFields: Record<string, string>;
  socialAccounts: SocialAccount[];
  interactions: InteractionEvent[];
  images: UploadedImage[];
  profileImage?: UploadedImage | null;
  profileImageId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Relationship {
  id: string;
  sourceContactId: string;
  targetContactId: string;
  sourceName: string;
  targetName: string;
  relationshipType: string;
  customRelationshipType?: string | null;
  relationshipLabel: string;
  relationshipStrength: number;
  notes?: string | null;
  startDate?: string | null;
  lastInteractionDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GraphNode {
  id: string;
  contactId?: string;
  label: string;
  type: "self" | "contact";
  relationshipType?: string;
  imageUrl?: string | null;
  strength?: number;
  suggestedStrength?: number;
  x?: number;
  y?: number;
  z?: number;
  fx?: number;
  fy?: number;
  fz?: number;
  vx?: number;
  vy?: number;
  vz?: number;
}

export interface GraphEdge {
  id: string;
  source: string | GraphNode;
  target: string | GraphNode;
  scope: "self" | "contact";
  type: string;
  label: string;
  manualStrength: number;
  strength: number;
  lastInteractionDate?: string | null;
}

export interface GraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
