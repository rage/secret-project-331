import { useContext } from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import { BlockRendererProps } from "../.."
import PageContext from "../../../../contexts/PageContext"
import { fetchUserCourseProgress } from "../../../../services/backend"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../shared-module/components/Spinner"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

import CourseProgress from "./CourseProgress"

const CourseProgressBlock: React.FC<BlockRendererProps<unknown>> = () => {
  const { t } = useTranslation()
  const pageContext = useContext(PageContext)
  const courseInstanceId = pageContext.instance?.id
  const getUserCourseProgress = useQuery(
    `course-instance-${courseInstanceId}-progress`,
    () => fetchUserCourseProgress(courseInstanceId as NonNullable<typeof courseInstanceId>),
    { enabled: !!courseInstanceId },
  )

  if (pageContext.state !== "ready") {
    return <Spinner variant={"small"} />
  }

  if (!pageContext.instance) {
    return <div>{t("select-course-version-to-see-your-progress")}</div>
  }

  return (
    <>
      {getUserCourseProgress.isError && (
        <ErrorBanner variant={"readOnly"} error={getUserCourseProgress.error} />
      )}
      {(getUserCourseProgress.isLoading || getUserCourseProgress.isIdle) && (
        <Spinner variant={"medium"} />
      )}
      {getUserCourseProgress.isSuccess && (
        <CourseProgress userCourseInstanceProgress={getUserCourseProgress.data} />
      )}
    </>
  )
}

export default withErrorBoundary(CourseProgressBlock)
