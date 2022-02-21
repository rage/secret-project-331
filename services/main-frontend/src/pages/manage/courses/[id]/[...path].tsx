import React from "react"
import { useTranslation } from "react-i18next"

import Layout from "../../../../components/Layout"
import Tab from "../../../../components/Tab"
import Tabs from "../../../../components/Tabs"
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
import createPendingChangeRequestCountHook from "../../../../hooks/count/usePendingChangeRequestCount"
import createUnreadFeedbackCountHook from "../../../../hooks/count/useUnreadFeedbackCount"
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

const CourseManagementPageTabs: {
  [key: string]: React.FC<CourseManagementPagesProps>
} = {
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
  const path = `${useQueryParameter("path")}`
  const { t } = useTranslation()

  // See if path exists, if not, default to first
  const PageToRender = CourseManagementPageTabs[path] ?? CourseManagementPageTabs["overview"]

  return (
    <Layout navVariant="complex">
      <Tabs>
        <Tab url={"overview"} isActive={path === "overview"}>
          {t("link-overview")}
        </Tab>
        <Tab url={"pages"} isActive={path === "pages"}>
          {t("link-pages")}
        </Tab>
        <Tab
          url={"feedback"}
          isActive={path === "feedback"}
          countHook={createUnreadFeedbackCountHook(courseId)}
        >
          {t("link-feedback")}
        </Tab>
        <Tab
          url={"change-requests"}
          isActive={path === "change-requests"}
          countHook={createPendingChangeRequestCountHook(courseId)}
        >
          {t("link-change-requests")}
        </Tab>
        <Tab url={"exercises"} isActive={path === "exercises"}>
          {t("link-exercises")}
        </Tab>
        <Tab url={"course-instances"} isActive={path === "course-instances"}>
          {t("link-course-instances")}
        </Tab>
        <Tab url={"language-versions"} isActive={path === "language-versions"}>
          {t("link-language-versions")}
        </Tab>
        <Tab url={"permissions"} isActive={path === "permissions"}>
          {t("link-permissions")}
        </Tab>
        <Tab url={"glossary"} isActive={path === "glossary"}>
          {t("link-glossary")}
        </Tab>
        <Tab url={"stats"} isActive={path === "stats"}>
          {t("link-stats")}
        </Tab>
      </Tabs>
      <PageToRender courseId={courseId} />
    </Layout>
  )
}

export default withErrorBoundary(
  withSignedIn(dontRenderUntilQueryParametersReady(CourseManagementPage)),
)
