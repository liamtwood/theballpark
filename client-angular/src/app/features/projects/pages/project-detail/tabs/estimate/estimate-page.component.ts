import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { EditSectionComponent } from '../../../../../../shared/components/edit-section/edit-section.component';
import { EstimateComponent } from './estimate.component';

/**
 * Estimate tab — v1.67. The page form of the (now-deprecated) estimate
 * drawer: the read-only financial summary (category rows + subtotal /
 * contingency / margin / VAT / client total + budget bar) rendered inside
 * the canonical card chrome.
 *
 * Reuses the existing read-only <app-estimate> verbatim (the same view the
 * estimate-drawer wrapped) inside a static <app-edit-section editable=false>
 * card — no logic duplicated. `embedded` flattens app-estimate's own page
 * wrapper so the card owns the padding + width.
 */
@Component({
  selector: 'app-estimate-page',
  standalone: true,
  imports: [CommonModule, EditSectionComponent, EstimateComponent],
  template: `
    <div class="bp-settings-body">
      <app-edit-section title="Estimate" [editable]="false" density="card">
        <app-estimate *ngIf="pid" [projectId]="pid" [embedded]="true"></app-estimate>
      </app-edit-section>
    </div>
  `,
  styles: []
})
export class EstimatePageComponent implements OnInit {
  pid = '';

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.pid = this.route.parent?.snapshot.paramMap.get('id') || '';
  }
}
