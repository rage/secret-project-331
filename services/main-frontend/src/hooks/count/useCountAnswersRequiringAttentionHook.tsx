import { UseQueryResult } from "@tanstack/react-query"

import useCourseExercisesAndCountAnswersRequitingAttentionQuery from "../useCourseExercisesAndCountAnswersRequitingAttentionQuery"

const useCountAnswersRequiringAttentionHook = (courseId: string) => {
  const useAnswersRequiringAttention = () => {
    return useCourseExercisesAndCountAnswersRequitingAttentionQuery(courseId, {
      select: (data) => {
        const res = data.reduce((acc, curr) => acc + (curr.count ?? 0), 0)
        // The typescript signature is not ideal here, we have to work around it a bit
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return res as any
      },
    }) as unknown as UseQueryResult<number>
  }
  return useAnswersRequiringAttention
}

export default useCountAnswersRequiringAttentionHook
