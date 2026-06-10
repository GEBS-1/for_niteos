import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { recordLeadEvent, sanitizeLeadId } from "@/lib/leadStore.server";

export interface FeedbackPayload {
  leadId?: string;
  interested: boolean;
  name?: string;
  phone?: string;
  email?: string;
  context?: {
    fixtureName?: string;
    fixtureId?: string;
    quantity?: number;
    totalPrice?: number;
  };
}

function normalizePhone(value: string): string {
  return value.replace(/\D/g, "");
}

function validateBody(body: unknown): FeedbackPayload | string {
  if (!body || typeof body !== "object") return "Некорректный запрос";
  const o = body as Record<string, unknown>;
  if (typeof o.interested !== "boolean") return "Укажите, интересно ли решение";

  const interested = o.interested;
  const name = typeof o.name === "string" ? o.name.trim() : "";
  const phone = typeof o.phone === "string" ? o.phone.trim() : "";
  const email = typeof o.email === "string" ? o.email.trim() : "";

  if (interested) {
    if (!name) return "Укажите имя";
    if (!phone) return "Укажите телефон";
    if (normalizePhone(phone).length < 10) return "Некорректный телефон";
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return "Некорректный email";
    }
  }

  let context: FeedbackPayload["context"];
  if (o.context && typeof o.context === "object") {
    const c = o.context as Record<string, unknown>;
    context = {
      fixtureName: typeof c.fixtureName === "string" ? c.fixtureName : undefined,
      fixtureId: typeof c.fixtureId === "string" ? c.fixtureId : undefined,
      quantity: typeof c.quantity === "number" ? c.quantity : undefined,
      totalPrice: typeof c.totalPrice === "number" ? c.totalPrice : undefined,
    };
  }

  const leadId =
    typeof o.leadId === "string" ? sanitizeLeadId(o.leadId) ?? undefined : undefined;

  return {
    leadId,
    interested,
    name: interested ? name : undefined,
    phone: interested ? phone : undefined,
    email: interested && email ? email : undefined,
    context,
  };
}

const STORE_PATH = path.join(process.cwd(), "data", "feedback-submissions.json");

function appendSubmission(entry: FeedbackPayload & { submittedAt: string }) {
  let list: (FeedbackPayload & { submittedAt: string })[] = [];
  if (fs.existsSync(STORE_PATH)) {
    try {
      list = JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
      if (!Array.isArray(list)) list = [];
    } catch {
      list = [];
    }
  }
  list.push(entry);
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(list, null, 2), "utf8");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = validateBody(body);
    if (typeof parsed === "string") {
      return NextResponse.json({ error: parsed }, { status: 400 });
    }

    const entry = {
      ...parsed,
      submittedAt: new Date().toISOString(),
    };

    console.info("[feedback]", JSON.stringify(entry));

    try {
      appendSubmission(entry);
    } catch (e) {
      console.warn("feedback store failed:", e);
    }

    if (parsed.leadId) {
      try {
        recordLeadEvent({
          leadId: parsed.leadId,
          type: "feedback",
          email: parsed.email,
          meta: {
            interested: parsed.interested,
            name: parsed.name,
            phone: parsed.phone,
            contactEmail: parsed.email,
            fixtureId: parsed.context?.fixtureId,
            fixtureName: parsed.context?.fixtureName,
            quantity: parsed.context?.quantity,
            totalPrice: parsed.context?.totalPrice,
          },
        });
      } catch (e) {
        console.warn("lead funnel feedback failed:", e);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
