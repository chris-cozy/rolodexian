import type { Contact, GraphResponse, Relationship } from "../types";

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
  }
};
