export type LeadStatus =
  | "NEW"
  | "CONTACTED"
  | "FOLLOW_UP"
  | "ENGAGED"
  | "OPTED_OUT";

export type LeadRow = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  property_address: string | null;
  intent: string | null;
  status: LeadStatus;
  redirect_token: string;
  clicked_at: Date | null;
  engaged_at: Date | null;
  engagement_started_at: Date | null;
  last_outbound_at: Date | null;
  opted_out_at: Date | null;
  lead_score: number;
  is_stuck: boolean;
  archived: boolean;
  archived_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type EmailRow = {
  id: string;
  lead_id: string;
  direction: "INBOUND" | "OUTBOUND";
  subject: string | null;
  body_text: string;
  external_id: string | null;
  template_key: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
};
