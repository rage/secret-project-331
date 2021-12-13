/* eslint-disable i18next/no-literal-string */

import { css } from "@emotion/css"

import { baseTheme } from "../shared-module/styles"

// old #227a64

export const quizTheme = {
  quizBodyColor: baseTheme.colors.grey[800],
  quizBodyFontSize: "24px",
  quizTitleFontSize: "16px",
  selectedItemBackground: "#24816a",
  selectedItemColor: baseTheme.colors.neutral[100],
}

export const SelectedQuizItem = css`
  background: ${baseTheme.colors.green[100]};
  color: ${baseTheme.colors.grey[100]};
`
