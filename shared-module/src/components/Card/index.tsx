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
    <>
      {props.variant === "simple" ? (
        <SimpleCard {...props}></SimpleCard>
      ) : props.variant === "course" ? (
        <SimpleCard {...props}></SimpleCard>
      ) : (
        <IllustrationCard {...props} />
      )}
    </>
  )
}

export default Card
