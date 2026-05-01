import {
  Component, ChangeDetectionStrategy, Input, Output, EventEmitter
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { SelectButtonModule } from 'primeng/selectbutton';
import { CircleSize, DetailSize } from '../catalogue-grid/catalogue-grid.component';

export type Layout = 'card' | 'list' | 'table';
export type DetailMode = 'inline' | 'drawer';
export type ThemeSwatch = '' | 'emerald' | 'pink' | 'ocean' | 'slate';

/**
 * Page-level config toggles — projected into the cog-driven config strip
 * by the catalogue-grid shell. Owns all the chrome (uppercase labels,
 * dividers, segmented buttons, theme swatches, page-label input) so
 * marketplace and feedback can both render an identical control row.
 *
 * State is two-way bound: pages keep authoritative copies and persist
 * however they want (org-wide via ConfigService, per-page via
 * localStorage etc). The component itself is stateless.
 *
 * Group visibility flags let pages hide individual rows if needed,
 * but by default every group renders so the two pages stay aligned.
 */
@Component({
  selector: 'app-page-config-toggles',
  standalone: true,
  imports: [CommonModule, FormsModule, InputTextModule, SelectButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bp-cfg-row">
      <ng-container *ngIf="showPageLabel">
        <span class="bp-cfg-lab">PAGE LABEL</span>
        <input pInputText
          class="bp-cfg-page-label"
          [(ngModel)]="pageLabel"
          (ngModelChange)="pageLabelChange.emit($event)"
          placeholder="Page name…"/>
        <span class="bp-cfg-divider"></span>
      </ng-container>

      <ng-container *ngIf="showTheme">
        <span class="bp-cfg-lab">THEME</span>
        <p-selectButton
          [options]="themeOptions"
          [(ngModel)]="theme"
          (onChange)="themeChange.emit(theme)"
          optionLabel="label"
          optionValue="value"
          styleClass="bp-cfg-swatches">
          <ng-template let-opt pTemplate>
            <span class="bp-cfg-swatch" [style.background]="opt.color"></span>
          </ng-template>
        </p-selectButton>
        <span class="bp-cfg-divider"></span>
      </ng-container>

      <ng-container *ngIf="showCircleSize">
        <span class="bp-cfg-lab">CIRCLE SIZE</span>
        <p-selectButton
          [options]="circleSizeOptions"
          [(ngModel)]="circleSize"
          (onChange)="circleSizeChange.emit(circleSize)"
          optionLabel="label"
          optionValue="value"
          styleClass="bp-cfg-seg"></p-selectButton>
        <span class="bp-cfg-divider"></span>
      </ng-container>

      <ng-container *ngIf="showView">
        <span class="bp-cfg-lab">VIEW</span>
        <p-selectButton
          [options]="viewOptions"
          [(ngModel)]="view"
          (onChange)="viewChange.emit(view)"
          optionLabel="label"
          optionValue="value"
          styleClass="bp-cfg-seg"></p-selectButton>
        <span class="bp-cfg-divider"></span>
      </ng-container>

      <ng-container *ngIf="showDetailSize">
        <span class="bp-cfg-lab">DETAIL SIZE</span>
        <p-selectButton
          [options]="detailSizeOptions"
          [(ngModel)]="detailSize"
          (onChange)="detailSizeChange.emit(detailSize)"
          optionLabel="label"
          optionValue="value"
          styleClass="bp-cfg-seg"></p-selectButton>
        <span class="bp-cfg-divider"></span>
      </ng-container>

      <ng-container *ngIf="showDetailMode">
        <span class="bp-cfg-lab">DETAIL MODE</span>
        <p-selectButton
          [options]="detailModeOptions"
          [(ngModel)]="detailMode"
          (onChange)="detailModeChange.emit(detailMode)"
          optionLabel="label"
          optionValue="value"
          styleClass="bp-cfg-seg"></p-selectButton>
      </ng-container>
    </div>
  `
})
export class PageConfigTogglesComponent {
  @Input() pageLabel = '';
  @Output() pageLabelChange = new EventEmitter<string>();

  @Input() theme: ThemeSwatch = '';
  @Output() themeChange = new EventEmitter<ThemeSwatch>();

  @Input() circleSize: CircleSize = 'md';
  @Output() circleSizeChange = new EventEmitter<CircleSize>();

  @Input() detailSize: DetailSize = 'md';
  @Output() detailSizeChange = new EventEmitter<DetailSize>();

  @Input() view: Layout = 'card';
  @Output() viewChange = new EventEmitter<Layout>();

  @Input() detailMode: DetailMode = 'inline';
  @Output() detailModeChange = new EventEmitter<DetailMode>();

  @Input() showPageLabel = true;
  @Input() showTheme = true;
  @Input() showCircleSize = true;
  @Input() showView = true;
  @Input() showDetailSize = true;
  @Input() showDetailMode = true;

  themeOptions = [
    { label: 'Amber',   value: '' as ThemeSwatch,        color: 'var(--theme-accent)' },
    { label: 'Emerald', value: 'emerald' as ThemeSwatch, color: '#00B84A' },
    { label: 'Pink',    value: 'pink' as ThemeSwatch,    color: '#FF0066' },
    { label: 'Ocean',   value: 'ocean' as ThemeSwatch,   color: '#2563EB' },
    { label: 'Slate',   value: 'slate' as ThemeSwatch,   color: '#64748B' }
  ];
  circleSizeOptions = [
    { label: 'Small · 56',  value: 'sm' as CircleSize },
    { label: 'Medium · 72', value: 'md' as CircleSize },
    { label: 'Large · 96',  value: 'lg' as CircleSize }
  ];
  detailSizeOptions = [
    { label: 'Small · 260',  value: 'sm' as DetailSize },
    { label: 'Medium · 320', value: 'md' as DetailSize },
    { label: 'Large · 420',  value: 'lg' as DetailSize }
  ];
  viewOptions = [
    { label: 'Card',  value: 'card' as Layout },
    { label: 'List',  value: 'list' as Layout },
    { label: 'Table', value: 'table' as Layout }
  ];
  detailModeOptions = [
    { label: 'Inline', value: 'inline' as DetailMode },
    { label: 'Drawer', value: 'drawer' as DetailMode }
  ];
}
