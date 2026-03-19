import { Component, OnInit } from '@angular/core';
import { CommonModule, KeyValuePipe } from '@angular/common';
import { LucideAngularModule, Truck, ChevronDown, ChevronRight, Package } from 'lucide-angular';
import { SupplierService } from '../../core/services/supplier.service';
import { Org, Item } from '../../core/models';
import { GbpPipe } from '../../shared/pipes/gbp.pipe';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-supplier-list',
  standalone: true,
  imports: [CommonModule, KeyValuePipe, LucideAngularModule, GbpPipe, LoadingSpinnerComponent, EmptyStateComponent],
  template: `
    <app-loading *ngIf="loading"></app-loading>
    <div *ngIf="!loading">
      <div class="mb-8"><h1 class="text-2xl font-bold text-gray-900">Suppliers</h1>
        <p class="text-sm text-gray-500 mt-1">{{suppliers.length}} registered suppliers</p></div>
      <app-empty-state *ngIf="suppliers.length===0" icon="pi-truck" message="No suppliers found."></app-empty-state>
      <div class="space-y-3" *ngIf="suppliers.length>0">
        <div *ngFor="let s of suppliers" class="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <button (click)="toggle(s)" class="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg flex items-center justify-center" style="background:var(--theme-bg);"><lucide-icon name="truck" [size]="18" style="color:var(--theme-accent);"></lucide-icon></div>
              <div><p class="text-sm font-semibold text-gray-900">{{s.name}}</p>
                <p class="text-xs text-gray-500">{{s.email||'No email'}}<span *ngIf="s.city"> · {{s.city}}</span></p></div>
            </div>
            <lucide-icon [name]="expanded[s.id] ? 'chevron-down' : 'chevron-right'" [size]="16" style="color:var(--color-text-muted);"></lucide-icon>
          </button>
          <div *ngIf="expanded[s.id]" class="border-t border-gray-200 px-6 py-4 bg-gray-50">
            <p *ngIf="!catalogues[s.id]" class="text-sm text-gray-400">Loading catalogue...</p>
            <p *ngIf="catalogues[s.id]?.length===0" class="text-sm text-gray-400">No catalogue items.</p>
            <div *ngIf="grouped[s.id]" class="space-y-4">
              <div *ngFor="let g of grouped[s.id]|keyvalue">
                <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2"><lucide-icon name="package" [size]="12" style="display:inline;vertical-align:middle;margin-right:4px;"></lucide-icon>{{g.key}}</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div *ngFor="let i of g.value" class="bg-white rounded-lg border border-gray-200 p-3 flex items-center justify-between">
                    <div><p class="text-sm font-medium text-gray-900">{{i.name}}</p>
                      <p *ngIf="i.description" class="text-xs text-gray-500 mt-0.5 truncate max-w-[250px]">{{i.description}}</p></div>
                    <div class="flex items-center gap-2 ml-3">
                      <span [class]="'text-xs px-1.5 py-0.5 rounded font-medium '+(i.tier==='premium'?'bg-purple-100 text-purple-700':i.tier==='mid'?'bg-blue-100 text-blue-700':'bg-gray-100 text-gray-600')">{{i.tier}}</span>
                      <span class="text-sm font-semibold text-gray-900 whitespace-nowrap">{{i.base_price|gbp}}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class SupplierListComponent implements OnInit {
  readonly icons = { Truck, ChevronDown, ChevronRight, Package };
  suppliers: Org[] = [];
  loading = true;
  expanded: Record<string, boolean> = {};
  catalogues: Record<string, Item[]> = {};
  grouped: Record<string, Record<string, Item[]>> = {};

  constructor(private svc: SupplierService) {}
  ngOnInit() { this.svc.getAll().subscribe({ next: d => { this.suppliers = d; this.loading = false; }, error: () => this.loading = false }); }

  toggle(s: Org) {
    this.expanded[s.id] = !this.expanded[s.id];
    if (this.expanded[s.id] && !this.catalogues[s.id]) {
      this.svc.getCatalogue(s.id).subscribe({
        next: items => {
          this.catalogues[s.id] = items;
          this.grouped[s.id] = items.reduce((a: Record<string, Item[]>, i) => {
            const c = i.category_name || 'Uncategorised';
            (a[c] = a[c] || []).push(i); return a;
          }, {});
        },
        error: () => { this.catalogues[s.id] = []; this.grouped[s.id] = {}; }
      });
    }
  }
}
