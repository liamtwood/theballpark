import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router } from '@angular/router';

import { ProjectService } from '../../core/services/project.service';
import { ConfigService } from '../../core/services/config.service';
import { HeroSettingsService } from '../../core/services/hero-settings.service';
import { Project } from '../../models';
import { HomeLauncherComponent, LauncherTile } from '../../shared/components/home-launcher/home-launcher.component';

/**
 * Projects hub — v1.68t. A supplier launch page built on the shared
 * <app-home-launcher> MASTER (same centred hero + tiles as Home / Marketplace
 * Profile). Splits the supplier's projects into three stage buckets, each tile
 * showing a live count and drilling into the /projects list.
 *
 * Buckets ↔ project_status codelist (draft / active / completed / archived):
 *   · Quoting            → draft      (in the approval workflow)
 *   · Live Projects      → active     (in production)
 *   · Completed Projects → completed + archived
 */
@Component({
  selector: 'app-projects-hub',
  standalone: true,
  imports: [CommonModule, HomeLauncherComponent],
  template: `
    <app-home-launcher [title]="title" [subtitle]="subtitle" [tiles]="tiles" [back]="back" [align]="align">
    </app-home-launcher>
  `,
})
export class ProjectsHubComponent implements OnInit {
  title = 'Events';   // replaced in ngOnInit with the configured label (plural)
  subtitle = 'Manage opportunities from quote to completion.';
  align: 'left' | 'center' = 'center';
  tiles: LauncherTile[] = [];

  private readonly pageKey = '/projects-hub';
  private defaultSubtitle = 'Manage opportunities from quote to completion.';

  /** Singular Events-label term from the global Ballpark config (the
      ballpark-settings "Projects are called" setting, default "Event"). */
  private get label(): string {
    return this.configService.projectLabel || 'Event';
  }

  back = () => this.location.back();

  constructor(
    private projectService: ProjectService,
    private configService: ConfigService,
    private heroSettings: HeroSettingsService,
    private location: Location,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.applyHeroSettings();
    this.buildTiles(0, 0, 0);
    this.loadCounts();
    // Live-apply page-settings (Title / Subtitle / Position) edits.
    this.configService.config$.subscribe(() => {
      this.applyHeroSettings();
      this.cdr.detectChanges();
    });
  }

  /** Resolve title / subtitle / alignment from the per-page settings, falling
      back to the configurable Events label + page default subtitle. */
  private applyHeroSettings(): void {
    this.title = this.heroSettings.title(this.pageKey, `${this.label}s`);
    this.subtitle = this.heroSettings.subtitle(this.pageKey, this.defaultSubtitle);
    this.align = this.heroSettings.align(this.pageKey);
  }

  /** (Re)build the three tiles with the current bucket counts. */
  private buildTiles(quoting: number, live: number, completed: number): void {
    this.tiles = [
      {
        icon: 'file-text',
        title: 'Quoting',
        subtitle: `${this.label}s currently progressing through the approval workflow.`,
        meta: this.countLabel(quoting),
        go: () => this.router.navigate(['/projects'], { queryParams: { bucket: 'quoting' } }),
      },
      {
        icon: 'zap',
        title: `Live ${this.label}s`,
        subtitle: `Active ${this.label.toLowerCase()}s currently in production.`,
        meta: this.countLabel(live),
        go: () => this.router.navigate(['/projects'], { queryParams: { bucket: 'live' } }),
      },
      {
        icon: 'circle-check',
        title: `Completed ${this.label}s`,
        subtitle: `Finished ${this.label.toLowerCase()}s and delivery history.`,
        meta: this.countLabel(completed),
        go: () => this.router.navigate(['/projects'], { queryParams: { bucket: 'completed' } }),
      },
    ];
  }

  /** Pluralised "N project(s)" footer line. */
  private countLabel(n: number): string {
    const noun = this.label.toLowerCase();
    return `${n} ${noun}${n === 1 ? '' : 's'}`;
  }

  /** Load all projects once and bucket by status key for the tile counts. */
  private loadCounts(): void {
    this.projectService.getAll().subscribe({
      next: (projects: Project[]) => {
        const list = projects || [];
        const keyOf = (p: Project) => (p.status_name || 'draft').toLowerCase();
        const quoting   = list.filter(p => keyOf(p) === 'draft').length;
        const live      = list.filter(p => keyOf(p) === 'active').length;
        const completed = list.filter(p => ['completed', 'archived'].includes(keyOf(p))).length;
        this.buildTiles(quoting, live, completed);
        this.cdr.detectChanges();
      },
      error: () => {},
    });
  }
}
