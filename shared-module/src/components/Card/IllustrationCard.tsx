import { ThemeProvider } from "@emotion/react"
import React from "react"

/* import { border, color, space } from "styled-system" */
import { theme } from "../../utils"

export interface CardExtraProps {
  variant: "simple" | "Illustration"
  title: string
  chapter: number
  url?: string
  bg?: string
  closedUntil?: string
}

export type CardProps = React.ButtonHTMLAttributes<HTMLDivElement> & CardExtraProps

const IllustrationCard: React.FC<CardProps> = () => {
  return (
    <ThemeProvider theme={theme}>
      <div></div>
    </ThemeProvider>
  )
}

export default IllustrationCard
