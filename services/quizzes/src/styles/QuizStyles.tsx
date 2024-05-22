/* eslint-disable i18next/no-literal-string */

import { css } from "@emotion/css"

import { baseTheme } from "@/shared-module/common/styles"

export const quizTheme = {
  gradingCorrectItemBackground: "#d5eadf",
  gradingWrongItemBackground: "#fbeef0",
  gradingCorrectItemColor: "#4c5868",
  gradingSelectedItemBorderColor: "#d8d8d8",
  gradingWrongItemBorderColor: "#f5d0d3",
  gradingCorrectItemBorderColor: "#69af8a",
  gradingSelectedItemBackground: "#f4f4f4",
  gradingSelectedItemColor: baseTheme.colors.clear[200],
  errorItemForegroundColor: baseTheme.colors.clear[200],
  errorItemBackgroundColor: baseTheme.colors.crimson[500],
  successItemBackgroundColor: baseTheme.colors.green[600],
  successItemForegroundColor: baseTheme.colors.clear[200],
  feedbackBackground: baseTheme.colors.clear[100],
  gradingWrongItemColor: "#4c5868",
  quizBodyColor: baseTheme.colors.gray[700],
  quizBodyFontSize: "24px",
  quizItemBackground: "fff",
  quizTitleFontSize: "20px",
  selectedItemBackground: baseTheme.colors.gray[700],
  selectedItemColor: baseTheme.colors.clear[100],
  // Quiz multiplechoices editor
  quizAnswer: baseTheme.colors.clear[100],
  quizWrongAnswer: baseTheme.colors.crimson[600],
  quizWrongAnswerHover: baseTheme.colors.crimson[500],
  quizCorrectAnswer: baseTheme.colors.green[600],
  quizCorrectAnswerHover: baseTheme.colors.green[500],
}

export const SelectedQuizItem = css`
  background: ${baseTheme.colors.green[100]};
  color: ${baseTheme.colors.gray[100]};
`
