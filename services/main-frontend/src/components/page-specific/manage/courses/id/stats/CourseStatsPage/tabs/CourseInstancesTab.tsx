"use client"

import React from "react"

import CourseCompletionsHistoryByInstance from "../../visualizations/course-instances/CourseCompletionsHistoryByInstance"
import FirstExerciseSubmissionsHistoryByInstance from "../../visualizations/course-instances/FirstExerciseSubmissionsHistoryByInstance"
import TotalStatsByInstance from "../../visualizations/course-instances/TotalStatsByInstance"
import UniqueUsersStartingHistoryByInstance from "../../visualizations/course-instances/UniqueUsersStartingHistoryByInstance"
import UsersReturningExercisesHistoryByInstance from "../../visualizations/course-instances/UsersReturningExercisesHistoryByInstance"

interface CourseInstancesTabProps {
  courseId: string
}

const CourseInstancesTab: React.FC<CourseInstancesTabProps> = ({ courseId }) => {
  return (
    <>
      <TotalStatsByInstance courseId={courseId} />
      <UniqueUsersStartingHistoryByInstance courseId={courseId} />
      <FirstExerciseSubmissionsHistoryByInstance courseId={courseId} />
      <UsersReturningExercisesHistoryByInstance courseId={courseId} />
      <CourseCompletionsHistoryByInstance courseId={courseId} />
    </>
  )
}

export default CourseInstancesTab
