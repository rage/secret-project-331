import React from "react"
import { useTranslation } from "react-i18next"

import Layout from "../../../../components/Layout"
import TabNavigation from "../../../../components/TabNavigation"
import CourseChangeRequests from "../../../../components/page-specific/manage/courses/id/change-request/CourseChangeRequests"
import CourseCourseInstances from "../../../../components/page-specific/manage/courses/id/course-instances/CourseCourseInstances"
import CourseExercises from "../../../../components/page-specific/manage/courses/id/exercises/CourseExercises"
import CourseFeedback from "../../../../components/page-specific/manage/courses/id/feedback/CourseFeedback"
import CourseGlossary from "../../../../components/page-specific/manage/courses/id/glossary/CourseGlossary"
import CourseOverview from "../../../../components/page-specific/manage/courses/id/index/CourseOverview"
import CourseLanguageVersionsPage from "../../../../components/page-specific/manage/courses/id/language-versions/CourseLanguageVersions"
import CoursePages from "../../../../components/page-specific/manage/courses/id/pages/CoursePages"
import CoursePermissions from "../../../../components/page-specific/manage/courses/id/permissions/CoursePermissions"
import CourseStatsPage from "../../../../components/page-specific/manage/courses/id/stats/CourseStatsPage"
import { withSignedIn } from "../../../../shared-module/contexts/LoginStateContext"
import useQueryParameter from "../../../../shared-module/hooks/useQueryParameter"
import {
  dontRenderUntilQueryParametersReady,
  SimplifiedUrlQuery,
} from "../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

export interface CourseManagementPagesProps {
  courseId: string
}

interface CourseManagementPageProps {
  // id | path
  query: SimplifiedUrlQuery<string>
}

const CourseManagementPageTabs: { [key: string]: React.FC<CourseManagementPagesProps> } = {
  overview: CourseOverview,
  pages: CoursePages,
  feedback: CourseFeedback,
  "change-requests": CourseChangeRequests,
  exercises: CourseExercises,
  "course-instances": CourseCourseInstances,
  "language-versions": CourseLanguageVersionsPage,
  permissions: CoursePermissions,
  glossary: CourseGlossary,
  stats: CourseStatsPage,
}

const CourseManagementPage: React.FC<CourseManagementPageProps> = ({ query }) => {
  const courseId = query.id
  // Matches key/url in CourseManagementPageTabs
  const path = `${useQueryParameter("path")}`
  const { t } = useTranslation()

  const PATHNAME = `/manage/courses/${courseId}`

  const PageToRender = CourseManagementPageTabs[path]
    ? CourseManagementPageTabs[path]
    : CourseManagementPageTabs["overview"]

  return (
    <Layout navVariant="complex">
      <TabNavigation
        tabs={Object.keys(CourseManagementPageTabs).map((url) => {
          return {
            // @ts-ignore: This should be taken into account, that useTranslation hook can be used in this way?
            title: t(`link-${url}`),
            url: { pathname: `${PATHNAME}/${url}` },
            isActive: path === url,
          }
        })}
      />
      <PageToRender courseId={courseId} />
    </Layout>
  )
}

export default withErrorBoundary(
  withSignedIn(dontRenderUntilQueryParametersReady(CourseManagementPage)),
)
