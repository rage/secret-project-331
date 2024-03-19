import { useQuery } from "@tanstack/react-query"
import { parseISO } from "date-fns"
import React, { useContext, useMemo } from "react"
import { useTranslation } from "react-i18next"

import PageContext from "../../../../contexts/PageContext"
import useCourseInfo from "../../../../hooks/useCourseInfo"
import {
  fetchCourseModuleExercisesAndSubmissionsByType,
  fetchDefaultModuleIdByCourseId,
  fetchModuleIdByChapterId,
} from "../../../../services/backend"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import MessageChannelIFrame from "../../../../shared-module/components/MessageChannelIFrame"
import {
  CustomViewIframeState,
  UserVariablesMap,
} from "../../../../shared-module/exercise-service-protocol-types"
import useUserInfo from "../../../../shared-module/hooks/useUserInfo"
import { assertNotNullOrUndefined } from "../../../../shared-module/utils/nullability"

interface CustomViewIframeProps {
  exerciseServiceSlug: string
  url: string | undefined
  title: string
}

const CustomViewIframe: React.FC<React.PropsWithChildren<CustomViewIframeProps>> = ({
  exerciseServiceSlug,
  url,
  title,
}) => {
  const { t } = useTranslation()
  const userInfo = useUserInfo()
  const pageContext = useContext(PageContext)
  const chapterId = pageContext.pageData?.chapter_id
  const courseInstanceId = pageContext.instance?.id
  const courseId = pageContext.settings?.current_course_id

  const courseInfo = useCourseInfo(pageContext.settings?.current_course_id)
  console.log(courseInfo.data?.name)
  const moduleIdByChapter = useQuery({
    queryKey: [`course-modules-chapter-${chapterId}`],
    queryFn: () => fetchModuleIdByChapterId(assertNotNullOrUndefined(chapterId)),
    enabled: !!chapterId,
  })

  const moduleIdByCourse = useQuery({
    queryKey: [`course-modules-course-${courseId}`],
    queryFn: () => fetchDefaultModuleIdByCourseId(assertNotNullOrUndefined(courseId)),
    enabled: !!courseId,
  })
  const moduleId = moduleIdByChapter.data ?? moduleIdByCourse.data

  const submissions_by_exercise = useQuery({
    queryKey: [
      `course-modules-${moduleId}-exercise-tasks-${exerciseServiceSlug}-${courseInstanceId}`,
    ],
    queryFn: () =>
      fetchCourseModuleExercisesAndSubmissionsByType(
        assertNotNullOrUndefined(moduleId),
        exerciseServiceSlug,
        assertNotNullOrUndefined(courseInstanceId),
      ),
    enabled: !!moduleId && !!courseInstanceId,
  })

  const submission_data = submissions_by_exercise.data
  const subs_by_exercise = useMemo(() => {
    if (!submission_data) {
      return null
    }
    return submission_data.exercises.map((exer) => {
      return {
        exercise_id: exer.id,
        exercise_name: exer.name,
        exercise_tasks: submission_data.exercise_tasks.task_gradings
          .filter((grading) => grading.exercise_id == exer.id)
          .map((grading) => {
            const answer = submission_data.exercise_tasks.task_submissions
              .filter((sub) => sub.exercise_task_grading_id == grading.id)
              .sort((a, b) => parseISO(b.created_at).getTime() - parseISO(a.created_at).getTime())
              .filter(
                (task_asnwer, index, array) =>
                  array.findIndex((el) => el.exercise_task_id === task_asnwer.exercise_task_id) ===
                  index,
              )[0]
            const publicSpec = submission_data.exercise_tasks.exercise_tasks.find(
              (task) => task.id == grading.exercise_task_id,
            )?.public_spec
            return {
              task_id: grading.exercise_task_id,
              public_spec: publicSpec,
              user_answer: answer,
              grading: grading,
            }
          })
          .sort(
            (a, b) =>
              a.task_id.localeCompare(b.task_id) ||
              parseISO(b.grading.created_at).getTime() - parseISO(a.grading.created_at).getTime(),
          )
          .filter(
            (task, index, array) => array.findIndex((el) => el.task_id === task.task_id) === index,
          ),
      }
    })
  }, [submission_data])

  const user_vars = useMemo(() => {
    if (!submission_data) {
      return null
    }
    const res: UserVariablesMap = {}
    submission_data?.user_variables.forEach(
      (item) => (res[item.variable_key] = item.variable_value),
    )
    return res
  }, [submission_data])
  if (!url || url.trim() === "") {
    return <ErrorBanner error={t("cannot-render-exercise-task-missing-url")} variant="readOnly" />
  }

  if (!userInfo.data || !subs_by_exercise || !courseInfo.data) {
    return null
  }

  const postThisStateToIFrame: CustomViewIframeState = {
    view_type: "custom-view",
    course_name: courseInfo.data?.name,
    user_information: {
      user_id: userInfo.data.user_id,
      first_name: userInfo.data.first_name,
      last_name: userInfo.data.last_name,
    },
    user_variables: user_vars,
    data: {
      submissions_by_exercise: subs_by_exercise,
    },
  }
  return (
    <MessageChannelIFrame
      url={url}
      postThisStateToIFrame={postThisStateToIFrame}
      onMessageFromIframe={async (_messageContainer, _responsePort) => {
        // NOP
      }}
      title={title}
    />
  )
}

export default CustomViewIframe
