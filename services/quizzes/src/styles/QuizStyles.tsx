/* eslint-disable i18next/no-literal-string */

import { css } from "@emotion/css"

import { baseTheme } from "../shared-module/styles"

export const quizTheme = {
  gradingCorrectItemBackground: baseTheme.colors.green[400],
  gradingCorrectItemColor: baseTheme.colors.clear[700],
  gradingSelectedItemBackground: baseTheme.colors.grey[700],
  gradingSelectedItemColor: baseTheme.colors.clear[200],
  gradingWrongItemBackground: "#fcc5cd",
  gradingWrongItemColor: baseTheme.colors.clear[700],
  quizBodyColor: baseTheme.colors.grey[700],
  quizBodyFontSize: "24px",
  quizItemBackground: "#E9E9ED",
  quizTitleFontSize: "16px",
  selectedItemBackground: baseTheme.colors.green[600],
  selectedItemColor: baseTheme.colors.clear[100],
}

export const SelectedQuizItem = css`
  background: ${baseTheme.colors.green[100]};
  color: ${baseTheme.colors.grey[100]};
`
