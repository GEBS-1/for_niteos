/** Префикс для GitHub Pages: https://user.github.io/for_niteos/ */
export function getBasePath(): string {
  const raw = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  if (!raw || raw === "/") return "";
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

export function withBasePath(path: string): string {
  const base = getBasePath();
  const p = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}

export const isStaticHosting =
  process.env.NEXT_PUBLIC_STATIC_EXPORT === "true";
