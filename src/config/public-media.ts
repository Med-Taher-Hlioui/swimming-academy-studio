import generated from "./public-media-manifest.json";

export interface MediaApproval {
  status: string;
  declaredBy: string;
  date: string;
}

export interface PublicPhoto {
  placeholder?: boolean;
  id: string;
  sourceReviewId: string;
  section: string;
  url: string;
  alt: string;
  width: number;
  height: number;
  bytes: number;
  focalPoint: string;
  approval: MediaApproval;
  fallbackUrl: string;
  variants: { url: string; width: number; height: number; bytes: number }[];
}

export interface PublicVideo {
  available?: boolean;
  id: string;
  sourceReviewId: string;
  section: string;
  url: string;
  poster: string;
  posterBytes: number;
  width: number;
  height: number;
  duration: number;
  bytes: number;
  approval: MediaApproval;
  fallbackUrl: string;
  playLabel: string;
  description: string;
}

interface PublicMediaLibrary {
  photos: Record<"hero" | "technique" | "group" | "story" | "trial" | "location", PublicPhoto>;
  videos: Record<"hero" | "story", PublicVideo>;
}

/** Public-safe metadata only. Source filesystem paths stay in the ignored local audit. */
export const publicMedia: PublicMediaLibrary = generated;
