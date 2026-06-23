import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../api.service';

/** The Haiku brief parser's output (server: services/ai.service.js;
 *  ported from v1 models/parsed-brief). Item-level `categories` exist in
 *  the payload but pV2-PROJECTS-03 (scoped) ignores them — no items. */
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
  /** Present but unused in the scoped flow. */
  categories?: unknown[];
  topQuestions?: string[];
  raw_response?: string;
}

export interface ExtractedText {
  text: string;
  filename: string;
  length: number;
}

/** pV2-PROJECTS-03 (scoped) — reuses the proven v1 AI endpoints as-is
 *  (`/api/ai/*`, ungated stateless transforms): parse a written brief,
 *  or extract text from an uploaded file then parse that. */
@Injectable({ providedIn: 'root' })
export class AiService {
  private readonly api = inject(ApiService);

  parseBrief(text: string): Observable<ParsedBrief> {
    return this.api.post<ParsedBrief>('/api/ai/parse-brief', { raw_brief_text: text });
  }

  /** Multipart upload — HttpClient sets the boundary when body is FormData. */
  extractText(file: File): Observable<ExtractedText> {
    const fd = new FormData();
    fd.append('file', file, file.name);
    return this.api.post<ExtractedText>('/api/ai/extract-text', fd);
  }
}
