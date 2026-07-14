"use client"

import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { useContext } from "react"
import { useTranslation } from "react-i18next"

import type { BlockRendererProps } from "../.."

import CourseProgress from "./CourseProgress"

import { getCourseMaterialUserCourseProgress } from "@/generated/course-material-api/sdk.generated"
import type { UserCourseProgress } from "@/generated/course-material-api/types.generated"
import GenericInfobox from "@/shared-module/common/components/GenericInfobox"
import Spinner from "@/shared-module/common/components/Spinner"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { QueryResult } from "@/shared-module/components"
import { courseMaterialAtom } from "@/state/course-material"

const CourseProgressBlock: React.FC<React.PropsWithChildren<BlockRendererProps<unknown>>> = () => {
  const { t } = useTranslation()
  const courseMaterialState = useAtomValue(courseMaterialAtom)
  const courseInstanceId = courseMaterialState.instance?.id
  const loginStateContext = useContext(LoginStateContext)
  const getUserCourseProgress = useQuery({
    queryKey: [`course-instance-${courseInstanceId}-progress`],
    queryFn: (): Promise<UserCourseProgress[]> =>
      getCourseMaterialUserCourseProgress({
        path: {
          course_instance_id: assertNotNullOrUndefined(courseInstanceId),
        },
      }),
    enabled: !!courseInstanceId && loginStateContext.signedIn === true,
  })

  if (courseMaterialState.status !== "ready" || loginStateContext.isLoading) {
    return <Spinner variant={"small"} />
  }
  if (!loginStateContext.signedIn) {
    return <GenericInfobox>{t("please-log-in-to-see-your-progress")}</GenericInfobox>
  }
  if (!courseMaterialState.instance) {
    return <div>{t("select-course-version-to-see-your-progress")}</div>
  }

  return (
    <QueryResult
      query={getUserCourseProgress}
      emptyFallback={<CourseProgress userCourseProgress={[]} />}
    >
      {(data) => <CourseProgress userCourseProgress={data} />}
    </QueryResult>
  )
}

export default withErrorBoundary(CourseProgressBlock)
