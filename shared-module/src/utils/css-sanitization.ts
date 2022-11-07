export type FlexDirection = "column" | "column-reverse" | "row" | "row-reverse"

export function sanitizeFlexDirection(
  input: string | null,
  defaultValue: FlexDirection,
): FlexDirection {
  switch (input) {
    case "column":
    case "column-reverse":
    case "row":
    case "row-reverse":
      return input
    default:
      return defaultValue
  }
}
