/* eslint-disable i18next/no-literal-string */

import { css } from "@emotion/css"

import { baseTheme } from "../shared-module/styles"

export const quizTheme = {
  gradingCorrectItemBackground: baseTheme.colors.green[700],
  gradingCorrectItemColor: baseTheme.colors.clear[100],
  gradingSelectedItemBackground: baseTheme.colors.grey[700],
  gradingSelectedItemColor: baseTheme.colors.clear[200],
  gradingWrongItemBackground: baseTheme.colors.crimson[600],
  gradingWrongItemColor: baseTheme.colors.clear[200],
  quizBodyColor: baseTheme.colors.grey[700],
  quizBodyFontSize: "24px",
  quizItemBackground: baseTheme.colors.green[700],
  quizTitleFontSize: "16px",
  selectedItemBackground: baseTheme.colors.green[600],
  selectedItemColor: baseTheme.colors.clear[100],
}

export const SelectedQuizItem = css`
  background: ${baseTheme.colors.green[100]};
  color: ${baseTheme.colors.grey[100]};
`
