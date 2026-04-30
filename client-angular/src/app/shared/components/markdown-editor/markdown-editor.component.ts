import {
  Component, Input, Output, EventEmitter, ViewChild, ElementRef,
  ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { LucideAngularModule } from 'lucide-angular';
import { marked } from 'marked';

type Tab = 'edit' | 'preview';

@Component({
  selector: 'app-markdown-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './markdown-editor.component.html',
  styleUrls: ['./markdown-editor.component.css']
})
export class MarkdownEditorComponent {
  @Input() value = '';
  @Input() placeholder = 'Write notes...';
  @Input() rows = 10;
  @Input() label = '';
  @Input() showLabel = true;

  @Output() valueChange = new EventEmitter<string>();

  @ViewChild('ta') taRef?: ElementRef<HTMLTextAreaElement>;

  activeTab: Tab = 'edit';
  previewHtml: SafeHtml = '';

  constructor(
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef
  ) {}

  setTab(tab: Tab) {
    this.activeTab = tab;
    if (tab === 'preview') this.refreshPreview();
    this.cdr.markForCheck();
  }

  onInput(ev: Event) {
    const v = (ev.target as HTMLTextAreaElement).value;
    this.value = v;
    this.valueChange.emit(v);
  }

  // ── Toolbar actions ──────────────────────────────────────────────────

  bold()          { this.wrapSelection('**', '**', 'bold'); }
  italic()        { this.wrapSelection('_', '_', 'italic'); }
  strike()        { this.wrapSelection('~~', '~~', 'strike'); }
  inlineCode()    { this.wrapSelection('`', '`', 'code'); }
  h1()            { this.prependLine('# '); }
  h2()            { this.prependLine('## '); }
  h3()            { this.prependLine('### '); }
  bulletList()    { this.prependLine('- '); }
  numberedList()  { this.prependLine('1. '); }
  todo()          { this.prependLine('- [ ] '); }
  blockquote()    { this.prependLine('> '); }
  divider()       { this.insertAtCursor('\n---\n'); }

  table() {
    this.insertAtCursor(
      '\n| Column 1 | Column 2 | Column 3 |\n' +
      '|----------|----------|----------|\n' +
      '| Value    | Value    | Value    |\n'
    );
  }

  // ── Keyboard shortcuts ───────────────────────────────────────────────

  onKeydown(ev: KeyboardEvent) {
    const mod = ev.ctrlKey || ev.metaKey;
    if (mod && ev.key.toLowerCase() === 'b') { ev.preventDefault(); this.bold(); return; }
    if (mod && ev.key.toLowerCase() === 'i') { ev.preventDefault(); this.italic(); return; }
    if (mod && ev.key.toLowerCase() === 'k') { ev.preventDefault(); this.inlineCode(); return; }
    if (ev.key === 'Tab') {
      ev.preventDefault();
      this.insertAtCursor('  ');
    }
  }

  // ── Internals ────────────────────────────────────────────────────────

  private getTa(): HTMLTextAreaElement | null {
    return this.taRef?.nativeElement || null;
  }

  private commit(ta: HTMLTextAreaElement) {
    this.value = ta.value;
    this.valueChange.emit(this.value);
    this.cdr.markForCheck();
  }

  private wrapSelection(before: string, after: string, placeholder: string) {
    const ta = this.getTa();
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = ta.value.slice(start, end) || placeholder;
    const inserted = before + selected + after;
    ta.setRangeText(inserted, start, end, 'end');
    // Re-select the placeholder text so the user can type over it
    if (start === end) {
      const newStart = start + before.length;
      ta.setSelectionRange(newStart, newStart + placeholder.length);
    }
    ta.focus();
    this.commit(ta);
  }

  private prependLine(prefix: string) {
    const ta = this.getTa();
    if (!ta) return;
    const value = ta.value;
    const lineStart = value.lastIndexOf('\n', ta.selectionStart - 1) + 1;
    ta.setRangeText(prefix, lineStart, lineStart, 'end');
    ta.focus();
    this.commit(ta);
  }

  private insertAtCursor(text: string) {
    const ta = this.getTa();
    if (!ta) return;
    ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end');
    ta.focus();
    this.commit(ta);
  }

  private refreshPreview() {
    const html = marked.parse(this.value || '', { async: false }) as string;
    this.previewHtml = this.sanitizer.bypassSecurityTrustHtml(html);
  }
}
