import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { PageHeroComponent } from '../../../shell/page-hero/page-hero.component';
import { OrgProfileEditComponent } from '../../settings/profile/org-profile-edit.component';

/** Platform-admin org profile editor (host). Mounts the shared
 *  OrgProfileEditComponent in its admin mode ([orgId] set → GET/PUT
 *  /api/admin/orgs/:id) so any org's profile is editable WITHOUT going through
 *  the marketplace supplier-detail page (which assumes a catalogue). Reached
 *  from the admin Orgs list. */
@Component({
  selector: 'app-admin-org-edit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeroComponent, OrgProfileEditComponent],
  host: { class: 'block bp-vpfit' },
  template: `
    <app-page-hero
      align="block"
      [back]="{ label: 'Back', href: '/admin/orgs', history: true }"
      title="Edit organisation"
      subtitle="Platform-admin edit of this organisation's profile."
    ></app-page-hero>

    <div class="bp-page-body bp-page-body--workspace">
      @if (orgId(); as id) {
        <app-org-profile-edit [orgId]="id" />
      }
    </div>
  `,
})
export class AdminOrgEditComponent {
  private readonly route = inject(ActivatedRoute);
  protected readonly orgId = toSignal(this.route.paramMap.pipe(map((p) => p.get('orgId') ?? '')));
}
