/* eslint-disable i18next/no-literal-string */

import { css } from "@emotion/css"

import { baseTheme } from "../shared-module/styles"

export const quizTheme = {
  gradingCorrectItemBackground: baseTheme.colors.green[400],
  gradingCorrectItemColor: baseTheme.colors.neutral[800],
  gradingWrongItemBackground: "#fcc5cd",
  gradingWrongItemColor: baseTheme.colors.neutral[800],
  quizBodyColor: baseTheme.colors.grey[800],
  quizBodyFontSize: "24px",
  quizItemBackground: "#E9E9ED",
  quizTitleFontSize: "16px",
  selectedItemBackground: "#24816a",
  selectedItemColor: baseTheme.colors.neutral[100],
}

export const SelectedQuizItem = css`
  background: ${baseTheme.colors.green[100]};
  color: ${baseTheme.colors.grey[100]};
`
