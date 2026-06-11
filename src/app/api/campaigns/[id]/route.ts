import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/adminAuth.server";
import { getCampaignWithFunnel } from "@/lib/campaignStore.server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 401 });
  }

  const { id } = await params;
  const campaign = getCampaignWithFunnel(id);
  if (!campaign) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }
  return NextResponse.json({ campaign });
}
