"use client"

import { useParams } from "next/navigation"
import React from "react"
import { useTranslation } from "react-i18next"

import MainFrontendBreadCrumbs from "@/components/MainFrontendBreadCrumbs"
import useCountAnswersRequiringAttentionHook from "@/hooks/count/useCountAnswersRequiringAttentionHook"
import TabLink from "@/shared-module/common/components/Navigation/TabLinks/TabLink"
import TabLinkNavigation from "@/shared-module/common/components/Navigation/TabLinks/TabLinkNavigation"
import TabLinkPanel from "@/shared-module/common/components/Navigation/TabLinks/TabLinkPanel"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import useAuthorizeMultiple from "@/shared-module/common/hooks/useAuthorizeMultiple"
import dynamicImport from "@/shared-module/common/utils/dynamicImport"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

export interface CourseManagementPagesProps {
  courseId: string
}

export type TabPage = React.ComponentType<React.PropsWithChildren<CourseManagementPagesProps>>

const CourseOverview = dynamicImport<CourseManagementPagesProps>(
  () => import("../overview/CourseOverview"),
)
const CoursePages = dynamicImport<CourseManagementPagesProps>(() => import("../pages/CoursePages"))
const CourseModules = dynamicImport<CourseManagementPagesProps>(
  () => import("../pages/CourseModules"),
)
const CourseExercises = dynamicImport<CourseManagementPagesProps>(
  () => import("../exercises/CourseExercises"),
)
const CourseCourseInstances = dynamicImport<CourseManagementPagesProps>(
  () => import("../course-instances/CourseCourseInstances"),
)
const CourseLanguageVersionsPage = dynamicImport<CourseManagementPagesProps>(
  () => import("../language-versions/CourseLanguageVersions"),
)
const CoursePermissions = dynamicImport<CourseManagementPagesProps>(
  () => import("../permissions/CoursePermissions"),
)
const CourseStudentsPage = dynamicImport<CourseManagementPagesProps>(
  () => import("../students/CourseStudentsPage"),
)

const CourseManagementPageTabs: {
  [key: string]: TabPage
} = {
  overview: CourseOverview,
  pages: CoursePages,
  modules: CourseModules,
  exercises: CourseExercises,
  "course-instances": CourseCourseInstances,
  "language-versions": CourseLanguageVersionsPage,
  students: CourseStudentsPage,
  permissions: CoursePermissions,
}

type PageToRender =
  | {
      type: "page"
      component: TabPage
    }
  | { type: "students"; subtab: string }

function selectPageToRender(path: string): PageToRender {
  try {
    if (path && path.startsWith("students")) {
      const parts = path.split("/")
      const subtab = parts.length > 1 ? parts[1] : ""
      return { type: "students", subtab }
    }
  } catch (_e) {
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

const CourseManagementPage: React.FC = () => {
  const params = useParams<{ id: string; path?: string | string[] }>()
  const courseId = params.id
  const pathParam = params.path
  const path = Array.isArray(pathParam) ? pathParam.join("/") : (pathParam ?? "")
  const { t } = useTranslation()

  const isGlobalAdminQuery = useAuthorizeMultiple([
    { action: { type: "administrate" }, resource: { type: "global_permissions" } },
  ])
  const isGlobalAdmin = (isGlobalAdminQuery.isSuccess && isGlobalAdminQuery.data?.[0]) ?? false

  // See if path exists, if not, default to first
  // Or should we implement 404 Not Found page and router push there or return that page?
  const pageToRender = selectPageToRender(path)

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
          url={"exercises"}
          isActive={path === "exercises"}
          countHook={useCountAnswersRequiringAttentionHook(courseId)}
        >
          {t("link-exercises")}
        </TabLink>
        <TabLink url={"course-instances"} isActive={path === "course-instances"}>
          {t("link-course-instances")}
        </TabLink>
        {isGlobalAdmin === true && (
          <TabLink url={"students/users"} isActive={path.startsWith("students")}>
            {t("label-students")}
          </TabLink>
        )}
        <TabLink url={"language-versions"} isActive={path === "language-versions"}>
          {t("link-language-versions")}
        </TabLink>
        <TabLink url={"permissions"} isActive={path === "permissions"}>
          {t("link-permissions")}
        </TabLink>
      </TabLinkNavigation>
      <TabLinkPanel>
        {pageToRender.type === "page" ? (
          (() => {
            const PageComponent = pageToRender.component
            return <PageComponent courseId={courseId} />
          })()
        ) : isGlobalAdmin === true ? (
          <CourseStudentsPage courseId={courseId} />
        ) : null}
      </TabLinkPanel>
    </>
  )
}

export default withErrorBoundary(withSignedIn(CourseManagementPage))
