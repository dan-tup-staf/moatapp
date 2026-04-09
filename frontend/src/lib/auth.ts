const TOKEN_KEY = "moatapp_token";

export const tokenStorage = {
  get(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(TOKEN_KEY);
  },
  set(token: string): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(TOKEN_KEY, token);
  },
  clear(): void {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(TOKEN_KEY);
  },
};
