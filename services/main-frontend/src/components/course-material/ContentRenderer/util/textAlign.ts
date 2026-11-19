/**
 * A block's text alignment: Gutenberg's `style.typography.textAlign`, falling back to `legacy`,
 * the attribute older content stores it in.
 */
export const textAlignOf = (
  style: Record<string, unknown> | undefined,
  legacy: string | undefined,
): string | undefined => {
  const typography = style?.typography
  if (typeof typography === "object" && typography !== null && "textAlign" in typography) {
    const { textAlign } = typography
    if (typeof textAlign === "string") {
      return textAlign
    }
  }
  return legacy
}
