import React from "react"

import AverageTimeToSubmit from "../../visualizations/user-activity/AverageTimeToSubmit"
import CohortProgress from "../../visualizations/user-activity/CohortProgress"
import CourseSubmissionsByDay from "../../visualizations/user-activity/CourseSubmissionsByDay"
import CourseSubmissionsByWeekdayAndHour from "../../visualizations/user-activity/CourseSubmissionsByWeekdayAndHour"
import CourseUsersWithSubmissionsByDay from "../../visualizations/user-activity/CourseUsersWithSubmissionsByDay"
import FirstSubmissionTrends from "../../visualizations/user-activity/FirstSubmissionTrends"
import UsersReturningExercises from "../../visualizations/user-activity/UsersReturningExercises"

interface UserActivityTabProps {
  courseId: string
}

const UserActivityTab: React.FC<UserActivityTabProps> = ({ courseId }) => {
  return (
    <>
      <CourseUsersWithSubmissionsByDay courseId={courseId} />
      <CourseSubmissionsByDay courseId={courseId} />
      <CourseSubmissionsByWeekdayAndHour courseId={courseId} />
      <FirstSubmissionTrends courseId={courseId} />
      <UsersReturningExercises courseId={courseId} />
      <AverageTimeToSubmit courseId={courseId} />
      <CohortProgress courseId={courseId} />
    </>
  )
}

export default UserActivityTab
