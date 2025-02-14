import { css } from "@emotion/css"
import React from "react"

import { baseTheme } from "../../styles"
import basePath from "../../utils/base-path"

import IllustrationCard from "./IllustrationCard"
import SimpleCard from "./SimpleCard"

// type CourseCardProps = {
//   title: string
//   description: string
//   languages: string
// }

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
}

export type CardProps = React.ButtonHTMLAttributes<HTMLDivElement> & CardExtraProps

const variantToComponent = {
  simple: SimpleCard,
  course: SimpleCard,
  illustration: IllustrationCard,
}

const Card: React.FC<React.PropsWithChildren<CardProps>> = (props) => {
  const Component = variantToComponent[props.variant]

  if (props.url && (props.open || props.allowedToPreview)) {
    return (
      // This should be a next/link but there's a weird problem in firefox if you this when it's next/link
      // and navigate back straight away, if you click this the click won't register but will just scroll the
      // page up
      <a
        href={basePath() + props.url}
        className={css`
          text-decoration: none;
          display: block;
          &:focus-visible {
            outline: 4px solid ${baseTheme.colors.green[500]};
            outline-offset: 2px;
          }
          transition: filter 0.2s;
          filter: brightness(1) contrast(1);
        `}
      >
        <Component {...props} />
      </a>
    )
  }

  return <Component {...props} />
}

export default Card
