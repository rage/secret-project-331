/* eslint-disable i18next/no-literal-string */
import { DisplayDirection } from "../../types/quizTypes/privateSpec"

export type FlexDirection = "column" | "column-reverse" | "row" | "row-reverse"
export const DEFAULT_QUIZ_DIRECTION: DisplayDirection = "vertical"

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

export function sanitizeQuizDirection(input: FlexDirection | null): DisplayDirection {
  switch (input) {
    case "column":
    case "column-reverse":
      return "vertical"
    case "row":
    case "row-reverse":
      return "horizontal"
  }
  return DEFAULT_QUIZ_DIRECTION
}
