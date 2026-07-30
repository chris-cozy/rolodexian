import type {
  Contact,
  GraphResponse,
  ImportSummary,
  ProfileGalleryItem,
  ProfileSection,
  ProfileSectionType,
  Relationship
} from "./types";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    ...options,
    headers
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }
  return payload as T;
}

function filenameFromDisposition(disposition: string | null): string {
  if (!disposition) return "rolodexian-contacts.json";
  const encodedMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (encodedMatch?.[1]) return decodeURIComponent(encodedMatch[1].replace(/"/g, ""));
  const match = disposition.match(/filename="?([^"]+)"?/i);
  return match?.[1] || "rolodexian-contacts.json";
}

async function requestBlob(path: string) {
  const response = await fetch(path);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Request failed.");
  }
  return {
    blob: await response.blob(),
    filename: filenameFromDisposition(response.headers.get("Content-Disposition"))
  };
}

export const api = {
  async listContacts(params: { search?: string; relationshipType?: string } = {}) {
    const query = new URLSearchParams();
    if (params.search) query.set("search", params.search);
    if (params.relationshipType) query.set("relationshipType", params.relationshipType);
    const suffix = query.toString() ? `?${query}` : "";
    const payload = await request<{ contacts: Contact[] }>(`/api/contacts${suffix}`);
    return payload.contacts;
  },

  async getContact(id: string) {
    const payload = await request<{ contact: Contact }>(`/api/contacts/${id}`);
    return payload.contact;
  },

  async createContact(contact: Contact) {
    const payload = await request<{ contact: Contact }>("/api/contacts", {
      method: "POST",
      body: JSON.stringify(contact)
    });
    return payload.contact;
  },

  async updateContact(id: string, contact: Contact) {
    const payload = await request<{ contact: Contact }>(`/api/contacts/${id}`, {
      method: "PUT",
      body: JSON.stringify(contact)
    });
    return payload.contact;
  },

  async deleteContact(id: string) {
    await request<void>(`/api/contacts/${id}`, { method: "DELETE" });
  },

  async uploadImage(contactId: string, formData: FormData) {
    const payload = await request<{ contact: Contact }>(`/api/contacts/${contactId}/images`, {
      method: "POST",
      body: formData
    });
    return payload.contact;
  },

  async deleteImage(imageId: string) {
    await request<void>(`/api/images/${imageId}`, { method: "DELETE" });
  },

  async updateProfile(contactId: string, patch: { descriptor?: string | null }) {
    const payload = await request<{ contact: Contact }>(`/api/contacts/${contactId}/profile`, {
      method: "PATCH",
      body: JSON.stringify(patch)
    });
    return payload.contact;
  },

  async uploadBackground(contactId: string, file: File) {
    const formData = new FormData();
    formData.append("image", file);
    const payload = await request<{ contact: Contact }>(`/api/contacts/${contactId}/profile/background`, {
      method: "POST",
      body: formData
    });
    return payload.contact;
  },

  async deleteBackground(contactId: string) {
    const payload = await request<{ contact: Contact }>(`/api/contacts/${contactId}/profile/background`, {
      method: "DELETE"
    });
    return payload.contact;
  },

  async createProfileSection(contactId: string, input: { type: ProfileSectionType; title?: string; content?: { markdown?: string } }) {
    const payload = await request<{ section: ProfileSection }>(`/api/contacts/${contactId}/profile/sections`, {
      method: "POST",
      body: JSON.stringify(input)
    });
    return payload.section;
  },

  async updateProfileSection(sectionId: string, patch: { title?: string; content?: { markdown?: string } }) {
    const payload = await request<{ section: ProfileSection }>(`/api/profile-sections/${sectionId}`, {
      method: "PATCH",
      body: JSON.stringify(patch)
    });
    return payload.section;
  },

  async deleteProfileSection(sectionId: string) {
    await request<void>(`/api/profile-sections/${sectionId}`, { method: "DELETE" });
  },

  async reorderProfileSections(contactId: string, sectionIds: string[]) {
    const payload = await request<{ sections: ProfileSection[] }>(`/api/contacts/${contactId}/profile/sections/order`, {
      method: "PUT",
      body: JSON.stringify({ sectionIds })
    });
    return payload.sections;
  },

  async uploadGalleryImages(sectionId: string, files: File[]) {
    const formData = new FormData();
    files.forEach((file) => formData.append("images", file));
    const payload = await request<{ items: ProfileGalleryItem[] }>(`/api/profile-sections/${sectionId}/images`, {
      method: "POST",
      body: formData
    });
    return payload.items;
  },

  async updateGalleryItem(itemId: string, patch: { caption?: string | null }) {
    const payload = await request<{ item: ProfileGalleryItem }>(`/api/profile-section-images/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify(patch)
    });
    return payload.item;
  },

  async removeGalleryItem(itemId: string) {
    await request<void>(`/api/profile-section-images/${itemId}`, { method: "DELETE" });
  },

  async reorderGalleryItems(sectionId: string, itemIds: string[]) {
    const payload = await request<{ items: ProfileGalleryItem[] }>(`/api/profile-sections/${sectionId}/images/order`, {
      method: "PUT",
      body: JSON.stringify({ itemIds })
    });
    return payload.items;
  },

  async listRelationships() {
    const payload = await request<{ relationships: Relationship[] }>("/api/relationships");
    return payload.relationships;
  },

  async createRelationship(relationship: Partial<Relationship>) {
    const payload = await request<{ relationship: Relationship }>("/api/relationships", {
      method: "POST",
      body: JSON.stringify(relationship)
    });
    return payload.relationship;
  },

  async updateRelationship(id: string, relationship: Partial<Relationship>) {
    const payload = await request<{ relationship: Relationship }>(`/api/relationships/${id}`, {
      method: "PUT",
      body: JSON.stringify(relationship)
    });
    return payload.relationship;
  },

  async deleteRelationship(id: string) {
    await request<void>(`/api/relationships/${id}`, { method: "DELETE" });
  },

  async getGraph() {
    return request<GraphResponse>("/api/graph");
  },

  async exportContactsArchive() {
    return requestBlob("/api/contacts/export");
  },

  async importContactsArchive(file: File) {
    const formData = new FormData();
    formData.append("archive", file);
    const payload = await request<{ summary: ImportSummary }>("/api/contacts/import", {
      method: "POST",
      body: formData
    });
    return payload.summary;
  }
};
