import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ProjectEventFormComponent } from '../../../../../../shared/components/project-event-form/project-event-form.component';

/**
 * Project Details tab — v1.67. The canonical destination for editing a
 * project's event facts (Event details / Event type / Logistics).
 *
 * A thin page wrapper around the shared <app-project-event-form> at
 * card density — the SAME form the (now-deprecated) event-drawer mounts
 * at drawer density. All field markup + save logic live in the form;
 * this page only supplies the project id (from the parent route) and the
 * centred card-page body.
 */
@Component({
  selector: 'app-project-details',
  standalone: true,
  imports: [CommonModule, ProjectEventFormComponent],
  template: `
    <div class="bp-settings-body">
      <app-project-event-form *ngIf="pid" [projectId]="pid" density="card"></app-project-event-form>
    </div>
  `,
  styles: []
})
export class ProjectDetailsComponent implements OnInit {
  pid = '';

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.pid = this.route.parent?.snapshot.paramMap.get('id') || '';
  }
}
