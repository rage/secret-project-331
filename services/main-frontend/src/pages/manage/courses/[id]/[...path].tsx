import React from "react"
import { useTranslation } from "react-i18next"

import useCountAnswersRequiringAttentionHook from "../../../../hooks/count/useCountAnswersRequiringAttentionHook"
import createPendingChangeRequestCountHook from "../../../../hooks/count/usePendingChangeRequestCount"
import createUnreadFeedbackCountHook from "../../../../hooks/count/useUnreadFeedbackCount"

import MainFrontendBreadCrumbs from "@/components/MainFrontendBreadCrumbs"
import Other from "@/components/page-specific/manage/courses/id/other"
import TabLink from "@/shared-module/common/components/Navigation/TabLinks/TabLink"
import TabLinkNavigation from "@/shared-module/common/components/Navigation/TabLinks/TabLinkNavigation"
import TabLinkPanel from "@/shared-module/common/components/Navigation/TabLinks/TabLinkPanel"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import useQueryParameter from "@/shared-module/common/hooks/useQueryParameter"
import {
  dontRenderUntilQueryParametersReady,
  SimplifiedUrlQuery,
} from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady"
import dynamicImport from "@/shared-module/common/utils/dynamicImport"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

export interface CourseManagementPagesProps {
  courseId: string
}

interface CourseManagementPageProps {
  // id | path
  query: SimplifiedUrlQuery<string>
}

export type TabPage = React.ComponentType<React.PropsWithChildren<CourseManagementPagesProps>>

const CourseOverview = dynamicImport<CourseManagementPagesProps>(
  () => import("@/components/page-specific/manage/courses/id/index/CourseOverview"),
)
const CoursePages = dynamicImport<CourseManagementPagesProps>(
  () => import("@/components/page-specific/manage/courses/id/pages/CoursePages"),
)
const CourseModules = dynamicImport<CourseManagementPagesProps>(
  () => import("@/components/page-specific/manage/courses/id/pages/CourseModules"),
)
const CourseFeedback = dynamicImport<CourseManagementPagesProps>(
  () => import("@/components/page-specific/manage/courses/id/feedback/CourseFeedback"),
)
const CourseChangeRequests = dynamicImport<CourseManagementPagesProps>(
  () => import("@/components/page-specific/manage/courses/id/change-request/CourseChangeRequests"),
)
const CourseExercises = dynamicImport<CourseManagementPagesProps>(
  () => import("@/components/page-specific/manage/courses/id/exercises/CourseExercises"),
)
const CourseCourseInstances = dynamicImport<CourseManagementPagesProps>(
  () =>
    import("@/components/page-specific/manage/courses/id/course-instances/CourseCourseInstances"),
)
const CourseLanguageVersionsPage = dynamicImport<CourseManagementPagesProps>(
  () =>
    import("@/components/page-specific/manage/courses/id/language-versions/CourseLanguageVersions"),
)
const CoursePermissions = dynamicImport<CourseManagementPagesProps>(
  () => import("@/components/page-specific/manage/courses/id/permissions/CoursePermissions"),
)
const CourseStatsPage = dynamicImport<CourseManagementPagesProps>(
  () => import("@/components/page-specific/manage/courses/id/stats/CourseStatsPage"),
)

const CourseManagementPageTabs: {
  [key: string]: TabPage
} = {
  overview: CourseOverview,
  pages: CoursePages,
  modules: CourseModules,
  feedback: CourseFeedback,
  "change-requests": CourseChangeRequests,
  exercises: CourseExercises,
  "course-instances": CourseCourseInstances,
  "language-versions": CourseLanguageVersionsPage,
  permissions: CoursePermissions,
  stats: CourseStatsPage,
}

type PageToRender =
  | {
      type: "page"
      component: TabPage
    }
  | {
      type: "other"
      subtab: string
    }

function selectPageToRender(path: string): PageToRender {
  // if page is other the path format is other/subtab
  try {
    if (path && path.startsWith("other")) {
      const pathParts = path.split("/")
      const subtab = pathParts.length > 1 ? pathParts[1] : ""
      return {
        type: "other",
        subtab,
      }
    }
  } catch (_e) {
    // Default to overview
    return {
      type: "page",
      component: CourseManagementPageTabs["overview"],
    }
  }
  return {
    type: "page",
    component: CourseManagementPageTabs[path] ?? CourseManagementPageTabs["overview"],
  }
}

const CourseManagementPage: React.FC<React.PropsWithChildren<CourseManagementPageProps>> = ({
  query,
}) => {
  const courseId = query.id
  const path = `${useQueryParameter("path")}`
  const { t } = useTranslation()

  // See if path exists, if not, default to first
  // Or should we implement 404 Not Found page and router push there or return that page?
  const pageToRender = selectPageToRender(path)

  console.log("pageToRender", pageToRender)

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
        <TabLink url={"stats"} isActive={path === "stats"}>
          {t("link-stats")}
        </TabLink>
        <TabLink url={"other/references"} isActive={path.startsWith("other")}>
          {t("title-other")}
        </TabLink>
      </TabLinkNavigation>
      <TabLinkPanel>
        {pageToRender.type === "page" ? (
          (() => {
            const PageComponent = pageToRender.component
            return <PageComponent courseId={courseId} />
          })()
        ) : (
          <Other courseId={courseId} activeSubtab={pageToRender.subtab} />
        )}
      </TabLinkPanel>
    </>
  )
}

export default withErrorBoundary(
  withSignedIn(dontRenderUntilQueryParametersReady(CourseManagementPage)),
)
