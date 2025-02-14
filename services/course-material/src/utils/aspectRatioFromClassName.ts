export default function aspectRatioFromClassName(className?: string): string {
  let aspectRatio = "16 / 9"
  if (className?.indexOf("wp-embed-aspect-21-9") != -1) {
    aspectRatio = "21 / 9"
  }
  if (className?.indexOf("wp-embed-aspect-18-9") != -1) {
    aspectRatio = "18 / 9"
  }
  if (className?.indexOf("wp-embed-aspect-16-9") != -1) {
    aspectRatio = "16 / 9"
  }
  if (className?.indexOf("wp-embed-aspect-4-3") != -1) {
    aspectRatio = "4 / 3"
  }
  if (className?.indexOf("wp-embed-aspect-1-1") != -1) {
    aspectRatio = "1 / 1"
  }
  if (className?.indexOf("wp-embed-aspect-9-16") != -1) {
    aspectRatio = "9 / 16"
  }
  if (className?.indexOf("wp-embed-aspect-1-2") != -1) {
    aspectRatio = "1 / 2"
  }
  return aspectRatio
}
