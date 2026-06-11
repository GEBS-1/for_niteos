import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/adminAuth.server";
import { listLeads } from "@/lib/leadStore.server";

export async function GET(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 401 });
  }

  const leads = listLeads();
  return NextResponse.json({
    count: leads.length,
    leads,
  });
}
