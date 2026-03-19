export interface ParsedBrief {
  event_name?: string;
  event_date?: string;
  venue_name?: string;
  venue_city?: string;
  venue_address?: string;
  guest_count?: number;
  stand_size?: string;
  stand_type?: string;
  project_notes?: string;
  suggested_categories?: string[];
  ai_hints?: string;
  missing_fields?: string[];
}
