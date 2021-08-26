import { ThemeProvider } from "@emotion/react"
import React from "react"

import { theme } from "../../styles"

import IllustrationCard from "./IllustrationCard"
import SimpleCard from "./SimpleCard"

/* import { border, color, space } from "styled-system" */

export interface CardExtraProps {
  variant: "simple" | "Illustration"
  title: string
  chapterNumber: number
  url?: string
  bg?: string
  open?: boolean
  date?: string
  time?: string
}

export type CardProps = React.ButtonHTMLAttributes<HTMLDivElement> & CardExtraProps

const Card: React.FC<CardProps> = (props) => {
  return (
    <ThemeProvider theme={theme}>
      {props.variant === "simple" ? (
        <SimpleCard {...props}></SimpleCard>
      ) : (
        <IllustrationCard {...props} />
      )}
    </ThemeProvider>
  )
}

export default Card
