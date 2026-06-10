import { NextRequest, NextResponse } from "next/server";
import { listLeads } from "@/lib/leadStore.server";

function isAuthorized(request: NextRequest): boolean {
  const token = process.env.LEADS_VIEW_TOKEN?.trim();
  if (!token) return process.env.NODE_ENV !== "production";
  const header = request.headers.get("x-leads-token");
  const query = request.nextUrl.searchParams.get("token");
  return header === token || query === token;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 401 });
  }

  const leads = listLeads();
  return NextResponse.json({
    count: leads.length,
    leads,
  });
}
