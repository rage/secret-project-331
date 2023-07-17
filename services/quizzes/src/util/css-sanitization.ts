import { DisplayDirection } from "../../types/quizTypes/privateSpec"

export type FlexDirection = "column" | "column-reverse" | "row" | "row-reverse"

export function sanitizeFlexDirection(
  input: DisplayDirection | null,
  defaultValue: FlexDirection,
): FlexDirection {
  switch (input) {
    case "vertical":
      return "column"
    case "horizontal":
      return "row"
    default:
      return defaultValue
  }
}
