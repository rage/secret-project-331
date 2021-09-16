import React from "react"

import { CardExtraProps } from "."

/* import { border, color, space } from "styled-system" */

export type CardProps = React.ButtonHTMLAttributes<HTMLDivElement> & CardExtraProps

const IllustrationCard: React.FC<CardProps> = () => {
  return (
    <>
      <div></div>
    </>
  )
}

export default IllustrationCard
