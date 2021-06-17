import React from "react"
import { CoursePage } from "../services/backend"

const PageContext = React.createContext<CoursePage | null>(null)

export default PageContext
