const ASPECT_RATIO_CLASSES: readonly [string, string][] = [
  ["wp-embed-aspect-21-9", "21 / 9"],
  ["wp-embed-aspect-18-9", "18 / 9"],
  ["wp-embed-aspect-16-9", "16 / 9"],
  ["wp-embed-aspect-4-3", "4 / 3"],
  ["wp-embed-aspect-1-1", "1 / 1"],
  ["wp-embed-aspect-9-16", "9 / 16"],
  ["wp-embed-aspect-1-2", "1 / 2"],
]

/** CSS aspect-ratio for an embed from its Gutenberg `wp-embed-aspect-*` class; 16 / 9 when it has none. */
export default function aspectRatioFromClassName(className?: string): string {
  const match = ASPECT_RATIO_CLASSES.find(([aspectClass]) => className?.includes(aspectClass))
  return match?.[1] ?? "16 / 9"
}
