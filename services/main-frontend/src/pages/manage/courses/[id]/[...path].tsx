import React from "react"
import { useTranslation } from "react-i18next"

import MainFrontendBreadCrumbs from "../../../../components/MainFrontendBreadCrumbs"
import CourseChangeRequests from "../../../../components/page-specific/manage/courses/id/change-request/CourseChangeRequests"
import CourseCheaters from "../../../../components/page-specific/manage/courses/id/cheaters/CourseCheaters"
import CourseCourseInstances from "../../../../components/page-specific/manage/courses/id/course-instances/CourseCourseInstances"
import CourseExercises from "../../../../components/page-specific/manage/courses/id/exercises/CourseExercises"
import CourseFeedback from "../../../../components/page-specific/manage/courses/id/feedback/CourseFeedback"
import CourseGlossary from "../../../../components/page-specific/manage/courses/id/glossary/CourseGlossary"
import CourseOverview from "../../../../components/page-specific/manage/courses/id/index/CourseOverview"
import CourseLanguageVersionsPage from "../../../../components/page-specific/manage/courses/id/language-versions/CourseLanguageVersions"
import CourseModules from "../../../../components/page-specific/manage/courses/id/pages/CourseModules"
import CoursePages from "../../../../components/page-specific/manage/courses/id/pages/CoursePages"
import CoursePermissions from "../../../../components/page-specific/manage/courses/id/permissions/CoursePermissions"
import References from "../../../../components/page-specific/manage/courses/id/references"
import CourseStatsPage from "../../../../components/page-specific/manage/courses/id/stats/CourseStatsPage"
import useCountAnswersRequiringAttentionHook from "../../../../hooks/count/useCountAnswersRequiringAttentionHook"
import createPendingChangeRequestCountHook from "../../../../hooks/count/usePendingChangeRequestCount"
import createUnreadFeedbackCountHook from "../../../../hooks/count/useUnreadFeedbackCount"

import TabLink from "@/shared-module/common/components/Navigation/TabLinks/TabLink"
import TabLinkNavigation from "@/shared-module/common/components/Navigation/TabLinks/TabLinkNavigation"
import TabLinkPanel from "@/shared-module/common/components/Navigation/TabLinks/TabLinkPanel"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import useQueryParameter from "@/shared-module/common/hooks/useQueryParameter"
import {
  dontRenderUntilQueryParametersReady,
  SimplifiedUrlQuery,
} from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
export interface CourseManagementPagesProps {
  courseId: string
}

interface CourseManagementPageProps {
  // id | path
  query: SimplifiedUrlQuery<string>
}

const CourseManagementPageTabs: {
  [key: string]: React.FC<React.PropsWithChildren<CourseManagementPagesProps>>
} = {
  overview: CourseOverview,
  pages: CoursePages,
  modules: CourseModules,
  references: References,
  feedback: CourseFeedback,
  "change-requests": CourseChangeRequests,
  exercises: CourseExercises,
  "course-instances": CourseCourseInstances,
  "language-versions": CourseLanguageVersionsPage,
  permissions: CoursePermissions,
  glossary: CourseGlossary,
  stats: CourseStatsPage,
  cheaters: CourseCheaters,
}

const CourseManagementPage: React.FC<React.PropsWithChildren<CourseManagementPageProps>> = ({
  query,
}) => {
  const courseId = query.id
  const path = `${useQueryParameter("path")}`
  const { t } = useTranslation()

  // See if path exists, if not, default to first
  // Or should we implement 404 Not Found page and router push there or return that page?
  const PageToRender = CourseManagementPageTabs[path] ?? CourseManagementPageTabs["overview"]

  return (
    <>
      <MainFrontendBreadCrumbs organizationSlug={null} courseId={courseId} />
      <TabLinkNavigation>
        <TabLink url={"overview"} isActive={path === "overview"}>
          {t("link-overview")}
        </TabLink>
        <TabLink url={"pages"} isActive={path === "pages"}>
          {t("link-pages")}
        </TabLink>
        <TabLink url={"modules"} isActive={path === "modules"}>
          {t("link-modules")}
        </TabLink>
        <TabLink url={"references"} isActive={path === "references"}>
          {t("references")}
        </TabLink>
        <TabLink
          url={"feedback"}
          isActive={path === "feedback"}
          countHook={createUnreadFeedbackCountHook(courseId)}
        >
          {t("link-feedback")}
        </TabLink>
        <TabLink
          url={"change-requests"}
          isActive={path === "change-requests"}
          countHook={createPendingChangeRequestCountHook(courseId)}
        >
          {t("link-change-requests")}
        </TabLink>
        <TabLink
          url={"exercises"}
          isActive={path === "exercises"}
          countHook={useCountAnswersRequiringAttentionHook(courseId)}
        >
          {t("link-exercises")}
        </TabLink>
        <TabLink url={"course-instances"} isActive={path === "course-instances"}>
          {t("link-course-instances")}
        </TabLink>
        <TabLink url={"language-versions"} isActive={path === "language-versions"}>
          {t("link-language-versions")}
        </TabLink>
        <TabLink url={"permissions"} isActive={path === "permissions"}>
          {t("link-permissions")}
        </TabLink>
        <TabLink url={"glossary"} isActive={path === "glossary"}>
          {t("link-glossary")}
        </TabLink>
        <TabLink url={"cheaters"} isActive={path === "cheaters"}>
          {t("link-cheaters")}
        </TabLink>
        <TabLink url={"stats"} isActive={path === "stats"}>
          {t("link-stats")}
        </TabLink>
      </TabLinkNavigation>
      <TabLinkPanel>
        <PageToRender courseId={courseId} />
      </TabLinkPanel>
    </>
  )
}

export default withErrorBoundary(
  withSignedIn(dontRenderUntilQueryParametersReady(CourseManagementPage)),
)
