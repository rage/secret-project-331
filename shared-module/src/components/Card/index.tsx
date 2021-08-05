import { ThemeProvider } from "@emotion/react"
import React from "react"

import { theme } from "../../utils"

import IllustrationCard from "./IllustrationCard"
import SimpleCard from "./SimpleCard"

/* import { border, color, space } from "styled-system" */

export interface CardExtraProps {
  variant: "simple" | "graphics"
  title: string
  chapter: string
  bg?: string
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
