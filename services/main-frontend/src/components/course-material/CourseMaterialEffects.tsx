"use client"

import React from "react"

import useCourseMaterialLanguageRedirection from "@/hooks/course-material/language/useCourseMaterialLanguageRedirection"

const CourseMaterialEffects: React.FC = () => {
  useCourseMaterialLanguageRedirection()
  return null
}

export default CourseMaterialEffects
