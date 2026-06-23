/** pV2-MEDIA-01 — shared media types. The image picker emits a discriminated
 *  union; the consumer maps it to its own update endpoint (picker is pure). */

export type PickerTab = 'upload' | 'find' | 'icon';

/** What the consuming card's cover will be cropped to — passed to the picker
 *  so the focal-point preview matches where the image actually lands. */
export type PreviewAspect = '4/3' | '1/1' | '16/9';

export interface PickerImageResult {
  type: 'image';
  url: string;
  source: 'upload' | 'unsplash';
  /** 0–100 percent; 50/50 = centre (default if the user doesn't set a focal point). */
  focalX: number;
  focalY: number;
  /** Mandatory when source==='unsplash' (MEDIA.md lock §4). */
  attribution?: { photographerName: string; photoUrl: string };
}

export interface PickerIconResult {
  type: 'icon';
  /** Lucide icon name (kebab). */
  name: string;
  /** A CSS custom-property name (token) for the icon's soft background. */
  color: string;
}

export type PickerResult = PickerImageResult | PickerIconResult;

/** pV2-MEDIA-01c — one slot in a multi-image gallery (stored as a JSONB array
 *  on the entity). Carries its own focal point + Unsplash attribution so "set
 *  as primary" can copy a slot straight into the entity's cover_* columns. */
export interface GalleryImage {
  url: string;
  /** 0–100 percent (object-position); 50/50 = centre. */
  focalX: number;
  focalY: number;
  attribution?: { photographerName: string; photoUrl: string };
}

/** Unsplash proxy result row (GET /api/unsplash/search). */
export interface UnsplashPhoto {
  url: string;
  thumb: string;
  description: string;
  photographer: string;
  photoUrl: string;
}

/** Soft-pastel icon-background swatches — token names (no raw hex in
 *  components). Defined in styles.css as --bp-pastel-*. */
export const DEFAULT_ICON_COLORS: readonly string[] = [
  '--bp-pastel-1',
  '--bp-pastel-2',
  '--bp-pastel-3',
  '--bp-pastel-4',
  '--bp-pastel-5',
  '--bp-pastel-6',
  '--bp-pastel-7',
  '--bp-pastel-8',
];
