/** Return a validated public origin for links sent in authentication emails. */
export function getPublicAppUrl(): string | null {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!configured) {
    return process.env.NODE_ENV === "production" ? null : "http://localhost:3000";
  }

  try {
    const url = new URL(configured);
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/") return null;
    const isLocalHttp = url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
    if (url.protocol !== "https:" && !isLocalHttp) return null;
    return url.origin;
  } catch {
    return null;
  }
}
