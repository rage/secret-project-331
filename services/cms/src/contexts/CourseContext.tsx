import React from "react"

interface CourseContextProps {
  courseId: string
}

const CourseContext = React.createContext<CourseContextProps | null>(null)

export default CourseContext
