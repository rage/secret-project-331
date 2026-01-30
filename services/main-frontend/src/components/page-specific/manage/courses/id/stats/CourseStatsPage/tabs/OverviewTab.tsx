"use client"

import React from "react"

import CompletionsChart from "../../visualizations/overview/CompletionsChart"
import CourseUsersCountsByExercise from "../../visualizations/overview/CourseUsersCountsByExercise"
import StudentsStartingTheCourseChart from "../../visualizations/overview/StudentsStartingTheCourseChart"
import TotalStats from "../../visualizations/overview/TotalStats"

interface OverviewTabProps {
  courseId: string
}

const OverviewTab: React.FC<OverviewTabProps> = ({ courseId }) => {
  return (
    <>
      <TotalStats courseId={courseId} />
      <StudentsStartingTheCourseChart courseId={courseId} />
      <CompletionsChart courseId={courseId} />
      <CourseUsersCountsByExercise courseId={courseId} />
    </>
  )
}

export default OverviewTab
