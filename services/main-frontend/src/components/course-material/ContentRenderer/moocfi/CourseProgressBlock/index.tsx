"use client"

import { useAtomValue } from "jotai"
import { useContext } from "react"
import { useTranslation } from "react-i18next"

import useUserCourseProgress from "@/hooks/course-material/useUserCourseProgress"
import GenericInfobox from "@/shared-module/common/components/GenericInfobox"
import Spinner from "@/shared-module/common/components/Spinner"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { QueryResult } from "@/shared-module/components"
import { courseMaterialAtom } from "@/state/course-material"

import type { BlockRendererProps } from "../.."
import CourseProgress from "./CourseProgress"

const CourseProgressBlock: React.FC<React.PropsWithChildren<BlockRendererProps<unknown>>> = () => {
  const { t } = useTranslation()
  const courseMaterialState = useAtomValue(courseMaterialAtom)
  const courseInstanceId = courseMaterialState.instance?.id
  const loginStateContext = useContext(LoginStateContext)
  const getUserCourseProgress = useUserCourseProgress(courseInstanceId)

  if (courseMaterialState.status !== "ready" || loginStateContext.isLoading) {
    return <Spinner variant={"small"} />
  }
  if (!loginStateContext.signedIn) {
    return <GenericInfobox>{t("please-log-in-to-see-your-progress")}</GenericInfobox>
  }
  if (!courseMaterialState.instance) {
    return <div>{t("select-course-version-to-see-your-progress")}</div>
  }
  const organizationSlug = courseMaterialState.organization?.slug
  const courseSlug = courseMaterialState.course?.slug
  const courseInstanceLocation =
    organizationSlug && courseSlug
      ? { courseInstanceId: courseMaterialState.instance.id, organizationSlug, courseSlug }
      : null

  return (
    <QueryResult
      query={getUserCourseProgress}
      emptyFallback={
        <CourseProgress
          userCourseProgress={[]}
          courseInstanceLocation={courseInstanceLocation}
          courseId={courseMaterialState.course?.id ?? null}
        />
      }
    >
      {(data) => (
        <CourseProgress
          userCourseProgress={data}
          courseInstanceLocation={courseInstanceLocation}
          courseId={courseMaterialState.course?.id ?? null}
        />
      )}
    </QueryResult>
  )
}

export default withErrorBoundary(CourseProgressBlock)
