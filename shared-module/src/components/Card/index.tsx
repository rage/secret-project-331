import { ThemeProvider } from "@emotion/react"
import React from "react"

import { theme } from "../../styles"

import CourseCard from "./CourseCard"
import IllustrationCard from "./IllustrationCard"
import SimpleCard from "./SimpleCard"

/* import { border, color, space } from "styled-system" */

type CourseCardProps = {
  title: string
  description: string
  languages: string
}

export interface CardExtraProps {
  variant: "simple" | "Illustration" | "course"
  title: string
  chapterNumber: number
  url?: string
  bg?: string
  open?: boolean
  date?: string
  time?: string
  description?: string
  languages?: string
}

export type CardProps = React.ButtonHTMLAttributes<HTMLDivElement> & CardExtraProps

const Card: React.FC<CardProps> = (props) => {
  return (
    <ThemeProvider theme={theme}>
      {props.variant === "simple" ? (
        <SimpleCard {...props}></SimpleCard>
      ) : props.variant === "course" ? (
        <CourseCard {...props}></CourseCard>
      ) : (
        <IllustrationCard {...props} />
      )}
    </ThemeProvider>
  )
}

export default Card
