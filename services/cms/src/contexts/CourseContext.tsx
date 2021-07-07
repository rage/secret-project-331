import React from "react"
import { CourseOverview } from "../services/services.types"

const CourseContext = React.createContext<CourseOverview | null>(null)

export default CourseContext
