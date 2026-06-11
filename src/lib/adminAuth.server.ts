import "server-only";

import type { NextRequest } from "next/server";

export function isAdminAuthorized(request: NextRequest): boolean {
  const token = process.env.LEADS_VIEW_TOKEN?.trim();
  if (!token) return process.env.NODE_ENV !== "production";
  const header = request.headers.get("x-leads-token");
  const query = request.nextUrl.searchParams.get("token");
  return header === token || query === token;
}
