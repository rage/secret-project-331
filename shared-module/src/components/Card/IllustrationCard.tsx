import React from "react"

import { CardExtraProps } from "."

export type CardProps = React.ButtonHTMLAttributes<HTMLDivElement> & CardExtraProps

const IllustrationCard: React.FC<CardProps> = () => {
  return (
    <>
      <div></div>
    </>
  )
}

export default IllustrationCard
