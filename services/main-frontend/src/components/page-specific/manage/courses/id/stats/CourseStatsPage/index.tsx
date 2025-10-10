import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import React, { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import {
  TAB_ALL_LANGUAGES,
  TAB_COURSE_INSTANCES,
  TAB_OVERVIEW,
  TAB_USER_ACTIVITY,
  TAB_VISITORS,
} from "./constants"

import { CourseManagementPagesProps } from "@/app/manage/courses/[id]/[...path]/page"
import useCourseInstancesQuery from "@/hooks/useCourseInstancesQuery"
import useCourseLanguageVersions from "@/hooks/useCourseLanguageVersions"
import TabLink from "@/shared-module/common/components/Navigation/TabLinks/TabLink"
import TabLinkNavigation from "@/shared-module/common/components/Navigation/TabLinks/TabLinkNavigation"
import TabLinkPanel from "@/shared-module/common/components/Navigation/TabLinks/TabLinkPanel"
import { baseTheme, headingFont } from "@/shared-module/common/styles"
import dynamicImport from "@/shared-module/common/utils/dynamicImport"
import withNoSsr from "@/shared-module/common/utils/withNoSsr"

export const DEFAULT_CHART_HEIGHT = 450

export const InstructionBox = styled.div`
  background-color: ${baseTheme.colors.clear[100]};
  border-left: 4px solid ${baseTheme.colors.blue[600]};
  padding: 1rem;
  margin-bottom: 2rem;
  border-radius: 4px;
  color: ${baseTheme.colors.gray[600]};
  font-size: 0.9rem;
  line-height: 1.5;
`

const OverviewTab = dynamicImport(() => import("./tabs/OverviewTab"))
const UserActivityTab = dynamicImport(() => import("./tabs/UserActivityTab"))
const VisitorsTab = dynamicImport(() => import("./tabs/VisitorsTab"))
const AllLanguagesTab = dynamicImport(() => import("./tabs/AllLanguagesTab"))
const CourseInstancesTab = dynamicImport(() => import("./tabs/CourseInstancesTab"))

const CourseStatsPage: React.FC<React.PropsWithChildren<CourseManagementPagesProps>> = ({
  courseId,
}) => {
  const { t } = useTranslation()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState(TAB_OVERVIEW)

  const courseLanguageVersions = useCourseLanguageVersions(courseId)
  const courseInstances = useCourseInstancesQuery(courseId)

  useEffect(() => {
    const tab = searchParams.get("tab")
    if (tab) {
      setActiveTab(tab)
    }
  }, [searchParams])

  const showLanguageVersionsTab = useMemo(
    () => courseLanguageVersions.isSuccess && courseLanguageVersions.data.length > 1,
    [courseLanguageVersions.isSuccess, courseLanguageVersions.data],
  )

  const showCourseInstancesTab = useMemo(
    () => courseInstances.isSuccess && courseInstances.data.length > 1,
    [courseInstances.isSuccess, courseInstances.data],
  )

  return (
    <>
      <h1
        className={css`
          font-size: clamp(2rem, 3.6vh, 36px);
          color: ${baseTheme.colors.gray[700]};
          font-family: ${headingFont};
          font-weight: bold;
        `}
      >
        {t("title-statistics")}
      </h1>

      <TabLinkNavigation>
        <TabLink
          url={{ pathname, query: { tab: TAB_OVERVIEW } }}
          isActive={activeTab === TAB_OVERVIEW}
        >
          {t("stats-tab-overview")}
        </TabLink>
        <TabLink
          url={{ pathname, query: { tab: TAB_USER_ACTIVITY } }}
          isActive={activeTab === TAB_USER_ACTIVITY}
        >
          {t("stats-tab-user-activity")}
        </TabLink>
        <TabLink
          url={{ pathname, query: { tab: TAB_VISITORS } }}
          isActive={activeTab === TAB_VISITORS}
        >
          {t("stats-tab-visitors")}
        </TabLink>
        {showLanguageVersionsTab && (
          <TabLink
            url={{ pathname, query: { tab: TAB_ALL_LANGUAGES } }}
            isActive={activeTab === TAB_ALL_LANGUAGES}
          >
            {t("stats-tab-all-languages")}
          </TabLink>
        )}
        {showCourseInstancesTab && (
          <TabLink
            url={{
              pathname,
              query: { tab: TAB_COURSE_INSTANCES },
            }}
            isActive={activeTab === TAB_COURSE_INSTANCES}
          >
            {t("stats-tab-course-instances")}
          </TabLink>
        )}
      </TabLinkNavigation>

      <TabLinkPanel>
        {activeTab === TAB_OVERVIEW && <OverviewTab courseId={courseId} />}
        {activeTab === TAB_USER_ACTIVITY && <UserActivityTab courseId={courseId} />}
        {activeTab === TAB_VISITORS && <VisitorsTab courseId={courseId} />}
        {activeTab === TAB_ALL_LANGUAGES && <AllLanguagesTab courseId={courseId} />}
        {activeTab === TAB_COURSE_INSTANCES && <CourseInstancesTab courseId={courseId} />}
      </TabLinkPanel>
    </>
  )
}

export default withNoSsr(CourseStatsPage)
