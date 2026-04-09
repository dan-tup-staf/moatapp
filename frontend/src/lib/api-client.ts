const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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

export class ApiError extends Error {
  constructor(public status: number, public detail: string) {
    super(detail);
  }
}

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

  return res.json() as Promise<T>;
}

export const api = {
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

  me: (token: string) => request<UserRead>("/auth/me", {}, token),
};
