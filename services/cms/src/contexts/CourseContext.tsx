import React from "react"

interface CourseContextProps {
  /** Id of the course that all media uploads are associated with. */
  courseId: string
}

const CourseContext = React.createContext<CourseContextProps | null>(null)

export default CourseContext
