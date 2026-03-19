import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { StepsModule } from 'primeng/steps';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { DropdownModule } from 'primeng/dropdown';
import { InputSwitchModule } from 'primeng/inputswitch';
import { MessageModule } from 'primeng/message';
import { MenuItem } from 'primeng/api';
import { LucideAngularModule, Sparkles } from 'lucide-angular';
import { ProjectService } from '../../../../core/services/project.service';
import { ClientService } from '../../../../core/services/client.service';
import { AiService } from '../../../../core/services/ai.service';
import { Client, ParsedBrief } from '../../../../models';

@Component({
  selector: 'app-project-create',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, LucideAngularModule, StepsModule, ButtonModule, InputTextModule, InputNumberModule, InputTextareaModule, DropdownModule, InputSwitchModule, MessageModule],
  template: `
    <div class="max-w-3xl mx-auto">
      <h1 class="text-2xl font-bold text-gray-900 mb-2">Create New Project</h1>
      <p class="text-sm text-gray-500 mb-8">Set up your exhibition project step by step</p>
      <p-steps [model]="steps" [activeIndex]="step" [readonly]="false" (activeIndexChange)="onStepClick($event)" styleClass="mb-8"></p-steps>

      <!-- Step 0: Tier -->
      <div *ngIf="step===0" class="bg-white rounded-lg border border-gray-200 shadow-sm p-8 mb-8">
        <h2 class="text-lg font-semibold text-gray-900 mb-1">Choose Your Tier</h2>
        <p class="text-sm text-gray-500 mb-6">Select the service level that fits your event</p>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button *ngFor="let t of tiers" (click)="f.tier=t.key"
            [class]="'text-left p-5 rounded-lg border-2 transition-all '+(f.tier===t.key?'border-brand-600 bg-brand-50 ring-2 ring-brand-600':'border-gray-200 hover:border-gray-300')">
            <h3 class="font-semibold text-gray-900 mb-1">{{t.name}}</h3>
            <p class="text-xs text-gray-500 mb-2">{{t.range}}</p>
            <p class="text-xs text-gray-600 leading-relaxed">{{t.desc}}</p>
          </button>
        </div>
      </div>

      <!-- Step 1: Event -->
      <div *ngIf="step===1" class="bg-white rounded-lg border border-gray-200 shadow-sm p-8 mb-8">
        <h2 class="text-lg font-semibold text-gray-900 mb-6">Event Details</h2>
        <div class="space-y-5">
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Event Name *</label>
            <input pInputText [(ngModel)]="f.event_name" placeholder="e.g. London Tech Expo 2026" class="w-full"/></div>
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Client</label>
            <p-dropdown [options]="clients" [(ngModel)]="f.client_id" optionLabel="name" optionValue="id" placeholder="Select client" [showClear]="true" styleClass="w-full"></p-dropdown></div>
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Event Date *</label>
            <input pInputText [(ngModel)]="f.event_date" placeholder="e.g. June 2026, 1st Tuesday in March" class="w-full"/></div>
          <div class="grid grid-cols-2 gap-4">
            <div><label class="block text-sm font-medium text-gray-700 mb-1">Venue Name</label><input pInputText [(ngModel)]="f.venue_name" class="w-full"/></div>
            <div><label class="block text-sm font-medium text-gray-700 mb-1">Venue City</label><input pInputText [(ngModel)]="f.venue_city" class="w-full"/></div>
          </div>
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Venue Address</label><input pInputText [(ngModel)]="f.venue_address" class="w-full"/></div>
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Guest Count</label>
            <p-inputNumber [(ngModel)]="f.guest_count" [useGrouping]="false" styleClass="w-full"></p-inputNumber></div>
        </div>
      </div>

      <!-- Step 2: Stand -->
      <div *ngIf="step===2" class="bg-white rounded-lg border border-gray-200 shadow-sm p-8 mb-8">
        <h2 class="text-lg font-semibold text-gray-900 mb-6">Stand Configuration</h2>
        <label class="block text-sm font-medium text-gray-700 mb-3">Stand Size</label>
        <div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <button *ngFor="let s of sizes" (click)="f.stand_size=s.key"
            [class]="'p-4 rounded-lg border-2 text-center transition-all '+(f.stand_size===s.key?'border-brand-600 bg-brand-50 ring-2 ring-brand-600':'border-gray-200 hover:border-gray-300')">
            <div class="text-sm font-semibold text-gray-900">{{s.label}}</div>
            <div class="text-lg font-bold text-brand-600 mt-1" *ngIf="s.key!=='custom'">{{s.sqm}} m²</div>
            <div class="text-xs text-gray-500">{{s.desc}}</div>
          </button>
        </div>
        <div *ngIf="f.stand_size==='custom'" class="grid grid-cols-2 gap-4 max-w-sm mb-6">
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Width (m)</label>
            <p-inputNumber [(ngModel)]="f.stand_width_m" [minFractionDigits]="1" styleClass="w-full"></p-inputNumber></div>
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Depth (m)</label>
            <p-inputNumber [(ngModel)]="f.stand_depth_m" [minFractionDigits]="1" styleClass="w-full"></p-inputNumber></div>
        </div>
        <label class="block text-sm font-medium text-gray-700 mb-3">Stand Type</label>
        <div class="flex gap-4">
          <button *ngFor="let t of standTypes" (click)="f.stand_type=t.key"
            [class]="'flex-1 p-4 rounded-lg border-2 text-left transition-all '+(f.stand_type===t.key?'border-brand-600 bg-brand-50 ring-2 ring-brand-600':'border-gray-200 hover:border-gray-300')">
            <div class="text-sm font-semibold text-gray-900">{{t.label}}</div>
            <div class="text-xs text-gray-500 mt-1">{{t.desc}}</div>
          </button>
        </div>
      </div>

      <!-- Step 3: Brief -->
      <div *ngIf="step===3" class="bg-white rounded-lg border border-gray-200 shadow-sm p-8 mb-8">
        <h2 class="text-lg font-semibold text-gray-900 mb-6">Project Brief</h2>
        <textarea pInputTextarea [(ngModel)]="f.raw_brief_text" [rows]="8" class="w-full mb-4" placeholder="Paste the client's brief here..."></textarea>
        <p-button icon="pi pi-sparkles" label="{{parsing?'Parsing...':'Parse with AI'}}" severity="help" [disabled]="parsing||!f.raw_brief_text" (click)="parseBrief()" [loading]="parsing"></p-button>
        <div *ngIf="parsed" class="mt-6 bg-gray-50 rounded-lg border border-gray-200 p-6">
          <h3 class="text-sm font-semibold text-gray-900 mb-4"><lucide-icon name="sparkles" [size]="14" style="color:var(--theme-accent);display:inline;vertical-align:middle;margin-right:6px;"></lucide-icon>Parsed Results</h3>
          <div *ngIf="parsed.suggested_categories?.length" class="mb-3">
            <label class="text-xs font-medium text-gray-500 uppercase">Categories</label>
            <div class="flex flex-wrap gap-2 mt-1">
              <span *ngFor="let c of parsed.suggested_categories" class="bg-brand-100 text-brand-700 text-xs px-2.5 py-1 rounded-full font-medium">{{c}}</span>
            </div>
          </div>
          <div *ngIf="parsed.ai_hints" class="mb-3"><label class="text-xs font-medium text-gray-500 uppercase">AI Hints</label><p class="text-sm text-gray-700 mt-1">{{parsed.ai_hints}}</p></div>
          <p-message *ngIf="parsed.missing_fields?.length" severity="warn" [text]="'Missing: '+parsed.missing_fields!.join(', ')"></p-message>
        </div>
      </div>

      <!-- Step 4: Financials -->
      <div *ngIf="step===4" class="bg-white rounded-lg border border-gray-200 shadow-sm p-8 mb-8">
        <h2 class="text-lg font-semibold text-gray-900 mb-6">Financials</h2>
        <div class="space-y-5">
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Project Budget (£)</label>
            <p-inputNumber [(ngModel)]="f.project_budget" mode="currency" currency="GBP" locale="en-GB" styleClass="w-full"></p-inputNumber></div>
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Share budget with suppliers</label>
            <p-inputSwitch [(ngModel)]="f.share_budget"></p-inputSwitch></div>
          <div class="grid grid-cols-3 gap-4">
            <div><label class="block text-sm font-medium text-gray-700 mb-1">Margin %</label><p-inputNumber [(ngModel)]="f.margin" suffix="%" styleClass="w-full"></p-inputNumber></div>
            <div><label class="block text-sm font-medium text-gray-700 mb-1">Contingency %</label><p-inputNumber [(ngModel)]="f.contingency" suffix="%" styleClass="w-full"></p-inputNumber></div>
            <div><label class="block text-sm font-medium text-gray-700 mb-1">VAT %</label><p-inputNumber [(ngModel)]="f.vat" suffix="%" styleClass="w-full"></p-inputNumber></div>
          </div>
        </div>
      </div>

      <div class="flex justify-between">
        <p-button icon="pi pi-chevron-left" label="Back" [outlined]="true" [disabled]="step===0" (click)="step=step-1"></p-button>
        <p-button *ngIf="step<4" icon="pi pi-chevron-right" iconPos="right" label="Next" [disabled]="!canNext()" (click)="step=step+1"></p-button>
        <p-button *ngIf="step===4" icon="pi pi-check" label="{{submitting?'Creating...':'Create Project'}}" [disabled]="submitting" (click)="submit()" [loading]="submitting"></p-button>
      </div>
    </div>
  `
})
export class ProjectCreateComponent implements OnInit {
  readonly icons = { Sparkles };
  step = 0;
  submitting = false;
  parsing = false;
  parsed: ParsedBrief | null = null;
  clients: Client[] = [];
  steps: MenuItem[] = [{ label: 'Tier' }, { label: 'Event' }, { label: 'Stand' }, { label: 'Brief' }, { label: 'Financials' }];
  tiers = [
    { key: 'starter', name: 'Starter', range: '£3k – £15k', desc: 'Shell scheme setup with essential furnishings.' },
    { key: 'professional', name: 'Professional', range: '£15k – £50k', desc: 'Custom build with graphics, lighting and AV.' },
    { key: 'premium', name: 'Premium', range: '£50k+', desc: 'Bespoke design with premium materials and full service.' },
  ];
  sizes = [
    { key: 'small', label: 'Small', sqm: 9, desc: '3×3m', w: 3, d: 3 },
    { key: 'medium', label: 'Medium', sqm: 24, desc: '6×4m', w: 6, d: 4 },
    { key: 'large', label: 'Large', sqm: 54, desc: '9×6m', w: 9, d: 6 },
    { key: 'xl', label: 'XL', sqm: 108, desc: '12×9m', w: 12, d: 9 },
    { key: 'custom', label: 'Custom', sqm: 0, desc: 'Enter size', w: 0, d: 0 },
  ];
  standTypes = [
    { key: 'shell_scheme', label: 'Shell Scheme', desc: 'Pre-built modular walls and fascia' },
    { key: 'space_only', label: 'Space Only', desc: 'Raw floor space for custom builds' },
  ];
  f: any = { tier: '', event_name: '', client_id: null, event_date: '', venue_name: '', venue_city: '', venue_address: '', guest_count: null, stand_size: '', stand_type: 'shell_scheme', stand_width_m: null, stand_depth_m: null, raw_brief_text: '', project_budget: null, share_budget: false, margin: 20, contingency: 5, vat: 20 };

  constructor(private router: Router, private projectSvc: ProjectService, private clientSvc: ClientService, private aiSvc: AiService) {}
  ngOnInit() { this.clientSvc.getAll().subscribe({ next: d => this.clients = d }); }
  onStepClick(i: number) { if (i <= this.step) this.step = i; }
  canNext(): boolean {
    if (this.step === 0) return !!this.f.tier;
    if (this.step === 1) return !!this.f.event_name && !!this.f.event_date;
    if (this.step === 2) return !!this.f.stand_size;
    return true;
  }
  parseBrief() {
    this.parsing = true;
    this.aiSvc.parseBrief(this.f.raw_brief_text).subscribe({ next: d => { this.parsed = d; this.parsing = false; }, error: () => this.parsing = false });
  }
  submit() {
    this.submitting = true;
    const sz = this.sizes.find(s => s.key === this.f.stand_size);
    const w = this.f.stand_size === 'custom' ? this.f.stand_width_m : sz?.w;
    const d = this.f.stand_size === 'custom' ? this.f.stand_depth_m : sz?.d;
    this.projectSvc.create({
      name: this.f.event_name, tier: this.f.tier, event_name: this.f.event_name, client_id: this.f.client_id || undefined,
      event_date: this.f.event_date, venue_name: this.f.venue_name, venue_city: this.f.venue_city, venue_address: this.f.venue_address,
      guest_count: this.f.guest_count, stand_size: this.f.stand_size, stand_width_m: w, stand_depth_m: d, stand_type: this.f.stand_type,
      raw_brief_text: this.f.raw_brief_text, parsed_brief_json: this.parsed || undefined,
      project_budget: this.f.project_budget, share_budget_with_suppliers: this.f.share_budget,
      default_margin_pct: this.f.margin, default_contingency_pct: this.f.contingency, default_vat_pct: this.f.vat,
    }).subscribe({ next: p => this.router.navigate(['/projects', p.id]), error: () => this.submitting = false });
  }
}
