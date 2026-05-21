import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiService } from './api.service';
import { ParsedBrief } from '../../models';
import { environment } from '../../../environments/environment';

export interface ExtractedText {
  text: string;
  filename: string;
  length: number;
}

@Injectable({ providedIn: 'root' })
export class AiService {
  constructor(private api: ApiService, private http: HttpClient) {}

  /** v1.38 — call the upgraded Haiku parser. Body is plain text. */
  parseBrief(text: string) {
    return this.api.post<ParsedBrief>('/ai/parse-brief', { raw_brief_text: text });
  }

  /** v1.39a — extract plain text from an uploaded brief file (PDF /
      DOCX / TXT / EML). Returns 415 for images + .doc; the modal then
      prompts the user to paste instead. */
  extractText(file: File) {
    const fd = new FormData();
    fd.append('file', file, file.name);
    return this.http.post<ExtractedText>(
      `${environment.apiUrl}/ai/extract-text`, fd
    );
  }
}
