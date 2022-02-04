import { css } from "@emotion/css"
import Link from "next/link"
import React from "react"

// import CourseCard from "./CourseCard"
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
  date?: string
  time?: string
  description?: string
  languages?: string
}

export type CardProps = React.ButtonHTMLAttributes<HTMLDivElement> & CardExtraProps

const variantToComponent = {
  simple: SimpleCard,
  course: SimpleCard,
  illustration: IllustrationCard,
}

const Card: React.FC<CardProps> = (props) => {
  const Component = variantToComponent[props.variant]

  if (props.url) {
    return (
      <Link href={props.url} passHref>
        <a
          href="replace"
          className={css`
            text-decoration: none;
            display: block;
          `}
          onClick={(e) => {
            console.log(e)
          }}
        >
          <Component {...props} />
        </a>
      </Link>
    )
  }

  return <Component {...props} />
}

export default Card
