import React from "react"

interface CourseContextProps {
  courseInstanceId: string
}

const CourseContext = React.createContext<CourseContextProps | null>(null)

export default CourseContext
