import React from "react"
import { CourseInstance, CoursePage } from "../services/backend"

export interface CoursePageWithInstance extends CoursePage {
  instance: CourseInstance | null | undefined
}

const PageContext = React.createContext<CoursePageWithInstance | null>(null)

export default PageContext
