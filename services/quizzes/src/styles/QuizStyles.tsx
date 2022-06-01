/* eslint-disable i18next/no-literal-string */

import { css } from "@emotion/css"

import { baseTheme } from "../shared-module/styles"

export const quizTheme = {
  gradingCorrectItemBackground: baseTheme.colors.green[600],
  gradingCorrectItemColor: baseTheme.colors.clear[100],
  gradingSelectedItemBackground: baseTheme.colors.grey[700],
  gradingSelectedItemColor: baseTheme.colors.clear[200],
  errorItemForegroundColor: baseTheme.colors.clear[200],
  errorItemBackgroundColor: baseTheme.colors.crimson[500],
  successItemBackgroundColor: baseTheme.colors.green[600],
  successItemForegroundColor: baseTheme.colors.clear[200],
  feedbackBackground: baseTheme.colors.clear[100],
  gradingWrongItemBackground: baseTheme.colors.red[600],
  gradingWrongItemColor: baseTheme.colors.clear[200],
  quizBodyColor: baseTheme.colors.grey[700],
  quizBodyFontSize: "24px",
  quizItemBackground: baseTheme.colors.clear[200],
  quizTitleFontSize: "18px",
  selectedItemBackground: baseTheme.colors.grey[700],
  selectedItemColor: baseTheme.colors.clear[100],
}

export const SelectedQuizItem = css`
  background: ${baseTheme.colors.green[100]};
  color: ${baseTheme.colors.grey[100]};
`
