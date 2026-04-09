import { tokenStorage } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ---------- Types ----------

export type UserRead = {
  id: number;
  email: string;
  name: string | null;
  created_at: string;
};

export type Token = {
  access_token: string;
  token_type: string;
};

export type LeadList = {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  leads_count: number;
};

export type LeadStatus =
  | "new"
  | "contacted"
  | "replied"
  | "bounced"
  | "unsubscribed";

export type Lead = {
  id: number;
  list_id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  title: string | null;
  linkedin_url: string | null;
  website: string | null;
  status: LeadStatus;
  score: number;
  notes: string | null;
  extra: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type LeadCreate = {
  email: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  title?: string;
  linkedin_url?: string;
  website?: string;
  status?: LeadStatus;
  notes?: string;
};

export type LeadUpdate = Partial<LeadCreate> & { score?: number };

export type CsvImportResult = {
  imported: number;
  skipped: number;
  errors: string[];
};

// ---------- Errors ----------

export class ApiError extends Error {
  constructor(public status: number, public detail: string) {
    super(detail);
  }
}

// ---------- Low-level helpers ----------

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) ?? {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/api/v1${path}`, { ...options, headers });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, data.detail ?? res.statusText);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

function authed<T>(path: string, options: RequestInit = {}): Promise<T> {
  return request<T>(path, options, tokenStorage.get());
}

async function uploadFile<T>(path: string, file: File): Promise<T> {
  const token = tokenStorage.get();
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, data.detail ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

// ---------- Public API ----------

export const api = {
  // Auth
  register: (data: { email: string; password: string; name?: string }) =>
    request<UserRead>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  login: (data: { email: string; password: string }) =>
    request<Token>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  me: () => authed<UserRead>("/auth/me"),

  // Lists
  lists: {
    list: () => authed<LeadList[]>("/lists"),

    create: (data: { name: string; description?: string }) =>
      authed<LeadList>("/lists", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    get: (id: number) => authed<LeadList>(`/lists/${id}`),

    update: (id: number, data: { name?: string; description?: string }) =>
      authed<LeadList>(`/lists/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    delete: (id: number) =>
      authed<void>(`/lists/${id}`, { method: "DELETE" }),
  },

  // Leads (nested under lists)
  leads: {
    list: (listId: number) => authed<Lead[]>(`/lists/${listId}/leads`),

    create: (listId: number, data: LeadCreate) =>
      authed<Lead>(`/lists/${listId}/leads`, {
        method: "POST",
        body: JSON.stringify(data),
      }),

    update: (listId: number, leadId: number, data: LeadUpdate) =>
      authed<Lead>(`/lists/${listId}/leads/${leadId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    delete: (listId: number, leadId: number) =>
      authed<void>(`/lists/${listId}/leads/${leadId}`, {
        method: "DELETE",
      }),

    importCsv: (listId: number, file: File) =>
      uploadFile<CsvImportResult>(`/lists/${listId}/leads/import`, file),
  },
};
