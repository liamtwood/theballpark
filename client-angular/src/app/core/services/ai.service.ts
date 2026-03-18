import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { ParsedBrief } from '../models';

@Injectable({ providedIn: 'root' })
export class AiService {
  constructor(private api: ApiService) {}
  parseBrief(text: string) {
    return this.api.post<ParsedBrief>('/ai/parse-brief', { raw_brief_text: text });
  }
}
