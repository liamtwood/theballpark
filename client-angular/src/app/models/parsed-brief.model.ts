/** AI parser response — v1.34 (Haiku prompt).
    Lives in lockstep with the system prompt in
    server/src/services/ai.service.js. */
export interface ParsedBrief {
  projectName?: string;
  client?: string;
  eventType?: string;
  location?: string;
  city?: string;
  dates?: string;
  durationDays?: number | null;
  guestCount?: number | null;
  budget?: string;
  budgetSignal?: 'Premium' | 'Professional' | 'Starter' | 'Unknown' | string;
  summary?: string;
  categories?: ParsedBriefCategory[];
  topQuestions?: string[];

  /** Returned only when the AI response wasn't valid JSON. */
  raw_response?: string;
}

export interface ParsedBriefCategory {
  /** One of: set-build|print|av|floral|venues|catering|photography|
      staffing|h-and-s|furniture|logistics|entertainment|lighting. */
  categoryId: string;
  categoryLabel: string;
  oneLiner: string;
  budgetEstimate?: string | null;
  implied?: boolean;
}
