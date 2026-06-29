"use client"

import { skipToken, useQuery } from "@tanstack/react-query"
import { parseISO } from "date-fns"
import { useAtomValue } from "jotai"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import {
  getCourseMaterialCourseModuleCompletionsForUser,
  getCourseMaterialDefaultModuleIdByCourseId,
  getCourseMaterialExerciseTasksByModuleAndType,
  getCourseMaterialModuleIdByChapterId,
} from "@/generated/course-material-api/sdk.generated"
import useCourseInfo from "@/hooks/course-material/useCourseInfo"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import { useDialog } from "@/shared-module/common/components/dialogs/DialogProvider"
import useUserInfo from "@/shared-module/common/hooks/useUserInfo"
import {
  CustomViewIframeState,
  UserVariablesMap,
} from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types"
import MessageChannelIFrame from "@/shared-module/exercise-react/parent/MessageChannelIFrame"
import {
  currentPageDataAtom,
  materialInstanceAtom,
  materialSettingsAtom,
} from "@/state/course-material/selectors"

interface CustomViewIframeProps {
  exerciseServiceSlug: string
  url: string | undefined
  title: string
}

const COURSE_MODULE_COMPLETIONS_FOR_USER_QUERY_KEY = "courseMaterialCourseModuleCompletionsForUser"
const MODULE_ID_BY_CHAPTER_QUERY_KEY = "courseMaterialModuleIdByChapterId"
const DEFAULT_MODULE_ID_BY_COURSE_QUERY_KEY = "courseMaterialDefaultModuleIdByCourseId"
const EXERCISE_TASKS_BY_MODULE_AND_TYPE_QUERY_KEY = "courseMaterialExerciseTasksByModuleAndType"

const CustomViewIframe: React.FC<React.PropsWithChildren<CustomViewIframeProps>> = ({
  exerciseServiceSlug,
  url,
  title,
}) => {
  const { t } = useTranslation()
  const dialog = useDialog()
  const userInfo = useUserInfo()
  const pageData = useAtomValue(currentPageDataAtom)
  const materialInstance = useAtomValue(materialInstanceAtom)
  const materialSettings = useAtomValue(materialSettingsAtom)
  const chapterId = pageData?.chapter_id
  const courseInstanceId = materialInstance?.id
  const courseId = materialSettings?.current_course_id
  const userId = userInfo.data?.user_id

  const courseModuleCompletionsQuery = useQuery({
    queryKey: [COURSE_MODULE_COMPLETIONS_FOR_USER_QUERY_KEY, courseInstanceId, userId] as const,
    queryFn:
      courseInstanceId && userId
        ? () =>
            getCourseMaterialCourseModuleCompletionsForUser({
              path: {
                course_instance_id: courseInstanceId,
                user_id: userId,
              },
            })
        : skipToken,
    enabled: Boolean(courseInstanceId && userId),
  })
  const courseInfo = useCourseInfo(materialSettings?.current_course_id)

  const moduleIdByChapter = useQuery({
    queryKey: [MODULE_ID_BY_CHAPTER_QUERY_KEY, chapterId] as const,
    queryFn: chapterId
      ? () =>
          getCourseMaterialModuleIdByChapterId({
            path: {
              chapter_id: chapterId,
            },
          })
      : skipToken,
    enabled: Boolean(chapterId),
  })

  const moduleIdByCourse = useQuery({
    queryKey: [DEFAULT_MODULE_ID_BY_COURSE_QUERY_KEY, courseId] as const,
    queryFn: courseId
      ? () =>
          getCourseMaterialDefaultModuleIdByCourseId({
            path: {
              course_id: courseId,
            },
          })
      : skipToken,
    enabled: Boolean(courseId),
  })
  const moduleId = moduleIdByChapter.data ?? moduleIdByCourse.data

  const submissionsByExerciseQuery = useQuery({
    queryKey: [
      EXERCISE_TASKS_BY_MODULE_AND_TYPE_QUERY_KEY,
      moduleId,
      exerciseServiceSlug,
      courseInstanceId,
    ] as const,
    queryFn:
      moduleId && courseInstanceId
        ? () =>
            getCourseMaterialExerciseTasksByModuleAndType({
              path: {
                course_module_id: moduleId,
                exercise_type: exerciseServiceSlug,
                course_instance_id: courseInstanceId,
              },
            })
        : skipToken,
    enabled: Boolean(moduleId && courseInstanceId),
  })

  const completionDate = courseModuleCompletionsQuery.data?.find(
    (compl) => compl.course_module_id === moduleId,
  )?.completion_date

  const submission_data = submissionsByExerciseQuery.data
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
            const answer = submission_data.exercise_tasks.task_submissions.find(
              (sub) => sub.exercise_task_grading_id === grading.id,
            )
            const publicSpec = submission_data.exercise_tasks.exercise_tasks.find(
              (task) => task.id === grading.exercise_task_id,
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
    // eslint-disable-next-line i18next/no-literal-string
    view_type: "custom-view",
    course_name: courseInfo.data?.name,
    module_completion_date: completionDate ? parseISO(completionDate).toLocaleDateString() : null,
    user_information: {
      user_id: userInfo.data.user_id,
      first_name: userInfo.data.first_name ?? null,
      last_name: userInfo.data.last_name ?? null,
    },
    user_variables: user_vars,
    data: {
      submissions_by_exercise: subs_by_exercise,
    },
  }
  return (
    <MessageChannelIFrame
      dialog={dialog}
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
