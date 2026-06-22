/** pV2-MEDIA-01f — per-entity completeness config. Pure client-side (MEDIA.md
 *  decision §7, no schema): each item is a weighted check with a deep-link
 *  `action` token the host maps to an editor (drawer / edit-section / gallery).
 *
 *  Config lives next to the entity's edit form so a field added to the form is
 *  considered for the config too (MEDIA.md RP-12 candidate). */
export interface CompletenessItem<T> {
  /** Relative weight toward 100% (weights need not sum to 100 — normalised). */
  readonly weight: number;
  /** Suggested-action copy, shown only while the item is unmet. */
  readonly label: string;
  /** Opaque token emitted on click; the host maps it to an editor. */
  readonly action: string;
  /** True when the entity satisfies this item. */
  readonly done: (entity: T) => boolean;
}

export type CompletenessConfig<T> = ReadonlyArray<CompletenessItem<T>>;
