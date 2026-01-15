"use client"

import React from "react"

import IllustrationCard from "./IllustrationCard"
import SimpleCard from "./SimpleCard"

export interface CardExtraProps {
  variant: "simple" | "illustration" | "course"
  title: string
  chapterNumber: number
  url?: string
  bg?: string
  open?: boolean
  allowedToPreview?: boolean
  date?: string
  time?: string
  description?: string
  languages?: string
  backgroundImage?: string | null
  points?: { awarded: number; max: number }
  showLock?: boolean
  isLocked?: boolean
}

export type CardProps = React.ButtonHTMLAttributes<HTMLDivElement> & CardExtraProps

const variantToComponent = {
  simple: SimpleCard,
  course: SimpleCard,
  illustration: IllustrationCard,
}

const Card: React.FC<React.PropsWithChildren<CardProps>> = (props) => {
  const Component = variantToComponent[props.variant]

  return <Component {...props} />
}

export default Card
