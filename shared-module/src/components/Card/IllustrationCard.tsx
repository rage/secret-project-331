import { ThemeProvider } from "@emotion/react"
import React from "react"

import { theme } from "../../styles"

import { CardExtraProps } from "."

/* import { border, color, space } from "styled-system" */

export type CardProps = React.ButtonHTMLAttributes<HTMLDivElement> & CardExtraProps

const IllustrationCard: React.FC<CardProps> = () => {
  return (
    <ThemeProvider theme={theme}>
      <div></div>
    </ThemeProvider>
  )
}

export default IllustrationCard
