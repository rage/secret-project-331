import axios from "axios"

import { UserCourseInstanceExerciseProgress } from "../../bindings"

export const fetchUserCourseInstanceExerciseProgress = async (
  courseInstanceId: string,
  exerciseId: string,
): Promise<UserCourseInstanceExerciseProgress> => {
  const data = (
    await axios.get(
      `/api/v0/course-material/course-instances/${courseInstanceId}/exercises/${exerciseId}/progress`,
    )
  ).data
  return data
}
