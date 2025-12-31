"use client"

import React from "react"

import useSwitchCourseLanguageVersionByUserInterfaceLanguage from "@/hooks/course-material/useSwitchCourseLanguageVersionByUserInterfaceLanguage"

const CourseMaterialEffects: React.FC = () => {
  useSwitchCourseLanguageVersionByUserInterfaceLanguage()
  return null
}

export default CourseMaterialEffects
