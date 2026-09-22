import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

/** A node in the extract task-list tree — mirrors the supplier's URL hierarchy
 *  (Catering Equipment Hire ▸ Crockery Hire ▸ …). `items` are products filed
 *  directly at this level; `children` are sub-groups; `allItems` is everything
 *  underneath (for the group tick + count). */
export interface TreeNode { key: string; label: string; items: string[]; children: TreeNode[]; allItems: string[]; }

/** Recursive accordion row: tick selects the whole subtree; the row expands to
 *  reveal child sub-groups then this level's own products. Selection state lives
 *  in the parent panel (signals); this component only renders + emits. */
@Component({
  selector: 'app-import-tree-node',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, ImportTreeNodeComponent],
  template: `
    <div class="mb-0.5">
      <div class="flex items-center gap-2">
        <input type="checkbox" class="bp-check" [checked]="allSel()" [indeterminate]="someSel()" (change)="toggleGroup.emit(node.allItems)" />
        <button type="button" class="flex items-center gap-1 font-medium bp-accordion-toggle" (click)="toggleExpand.emit(node.key)">
          <lucide-icon [name]="expanded.has(node.key) ? 'chevron-down' : 'chevron-right'" [size]="14" />
          <span>{{ node.label }}</span>
          <span class="text-secondary">({{ node.allItems.length }})</span>
        </button>
      </div>
      @if (expanded.has(node.key)) {
        <div class="ml-6 mt-0.5">
          @for (child of node.children; track child.key) {
            <app-import-tree-node [node]="child" [selected]="selected" [expanded]="expanded"
              (toggleItem)="toggleItem.emit($event)" (toggleGroup)="toggleGroup.emit($event)" (toggleExpand)="toggleExpand.emit($event)" />
          }
          @for (link of node.items; track link) {
            <label class="flex items-center gap-2 mb-0.5">
              <input type="checkbox" class="bp-check" [checked]="selected.has(link)" (change)="toggleItem.emit(link)" />
              <span class="truncate">{{ leaf(link) }}</span>
            </label>
          }
        </div>
      }
    </div>
  `,
})
export class ImportTreeNodeComponent {
  @Input({ required: true }) node!: TreeNode;
  @Input({ required: true }) selected!: Set<string>;
  @Input({ required: true }) expanded!: Set<string>;
  @Output() toggleItem = new EventEmitter<string>();
  @Output() toggleGroup = new EventEmitter<string[]>();
  @Output() toggleExpand = new EventEmitter<string>();

  protected allSel(): boolean { return this.node.allItems.length > 0 && this.node.allItems.every((u) => this.selected.has(u)); }
  protected someSel(): boolean { return !this.allSel() && this.node.allItems.some((u) => this.selected.has(u)); }
  protected leaf(u: string): string {
    try { const p = new URL(u).pathname.split('/').filter(Boolean); return p[p.length - 1] || u; } catch { return u; }
  }
}
