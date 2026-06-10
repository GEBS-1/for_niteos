export type LeadEventType = "visit" | "calculate" | "result_view" | "feedback";

export interface LeadEvent {
  type: LeadEventType;
  at: string;
  meta?: Record<string, string | number | boolean | null | undefined>;
}

export interface LeadRecord {
  leadId: string;
  email?: string;
  utmSource?: string;
  utmCampaign?: string;
  firstSeen: string;
  lastSeen: string;
  visited: boolean;
  visitCount: number;
  calculateCount: number;
  resultViewCount: number;
  feedbackSubmitted: boolean;
  interested?: boolean;
  name?: string;
  phone?: string;
  contactEmail?: string;
  lastFixtureId?: string;
  lastFixtureName?: string;
  lastQuantity?: number;
  lastTotalPrice?: number;
  events: LeadEvent[];
}

export interface LeadsFunnelStore {
  leads: Record<string, LeadRecord>;
}

export interface TrackEventPayload {
  leadId: string;
  type: LeadEventType;
  email?: string;
  utmSource?: string;
  utmCampaign?: string;
  meta?: Record<string, string | number | boolean | null | undefined>;
}
