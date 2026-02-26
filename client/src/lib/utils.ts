import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const TAG_COLOURS = [
  "tag-warm", "tag-teal", "tag-violet", "tag-sky",
  "tag-rose", "tag-lime", "tag-amber", "tag-slate",
];

export function tagColour(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TAG_COLOURS[Math.abs(hash) % TAG_COLOURS.length];
}
