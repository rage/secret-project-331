import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { useRouter } from "next/router"
import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { CourseManagementPagesProps } from "../../../../../../pages/manage/courses/[id]/[...path]"

import CompletionsChart from "./visualizations/overview/CompletionsChart"
import CourseUsersCountsByExercise from "./visualizations/overview/CourseUsersCountsByExercise"
import StudentsStartingTheCourseChart from "./visualizations/overview/StudentsStartingTheCourseChart"
import TotalStats from "./visualizations/overview/TotalStats"
import AverageTimeToSubmit from "./visualizations/user-activity/AverageTimeToSubmit"
import CohortProgress from "./visualizations/user-activity/CohortProgress"
import CourseSubmissionsByDay from "./visualizations/user-activity/CourseSubmissionsByDay"
import CourseSubmissionsByWeekdayAndHour from "./visualizations/user-activity/CourseSubmissionsByWeekdayAndHour"
import CourseUsersWithSubmissionsByDay from "./visualizations/user-activity/CourseUsersWithSubmissionsByDay"
import FirstSubmissionTrends from "./visualizations/user-activity/FirstSubmissionTrends"
import MonthlyUsersReturningExercises from "./visualizations/user-activity/MonthlyUsersReturningExercises"
import CourseVisitorsByCountry from "./visualizations/visitors/CourseVisitorsByCountry"
import CourseVisitorsByDay from "./visualizations/visitors/CourseVisitorsByDay"
import DailyVisitCountsGroupedByReferrer from "./visualizations/visitors/DailyVisitCountsGroupedByReferrer"
import DailyVisitCountsGroupedByUtm from "./visualizations/visitors/DailyVisitCountsGroupedByUtm"
import DeviceTypes from "./visualizations/visitors/DeviceTypes"
import MostVisitedPages from "./visualizations/visitors/MostVisitedPages"
import TopReferrers from "./visualizations/visitors/TopReferrers"
import TopUtmCampaigns from "./visualizations/visitors/TopUtmCampaigns"
import TopUtmSources from "./visualizations/visitors/TopUtmSources"

import TabLink from "@/shared-module/common/components/Navigation/TabLinks/TabLink"
import TabLinkNavigation from "@/shared-module/common/components/Navigation/TabLinks/TabLinkNavigation"
import TabLinkPanel from "@/shared-module/common/components/Navigation/TabLinks/TabLinkPanel"
import { baseTheme, headingFont } from "@/shared-module/common/styles"

export const StatHeading = styled.h2`
  font-size: 1.8rem;
  color: ${baseTheme.colors.gray[600]};
  font-family: ${headingFont};
  margin-bottom: 1rem;
  margin-top: 1rem;
`

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

const TAB_OVERVIEW = "overview"
const TAB_USER_ACTIVITY = "user-activity"
const TAB_VISITORS = "visitors"

const CourseStatsPage: React.FC<React.PropsWithChildren<CourseManagementPagesProps>> = ({
  courseId,
}) => {
  const { t } = useTranslation()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState(TAB_OVERVIEW)

  useEffect(() => {
    if (router.query.tab) {
      setActiveTab(router.query.tab as string)
    }
  }, [router.query.tab])

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
          url={{ pathname: router.pathname, query: { ...router.query, tab: TAB_OVERVIEW } }}
          isActive={activeTab === TAB_OVERVIEW}
        >
          {t("stats-tab-overview")}
        </TabLink>
        <TabLink
          url={{ pathname: router.pathname, query: { ...router.query, tab: TAB_USER_ACTIVITY } }}
          isActive={activeTab === TAB_USER_ACTIVITY}
        >
          {t("stats-tab-user-activity")}
        </TabLink>
        <TabLink
          url={{ pathname: router.pathname, query: { ...router.query, tab: TAB_VISITORS } }}
          isActive={activeTab === TAB_VISITORS}
        >
          {t("stats-tab-visitors")}
        </TabLink>
      </TabLinkNavigation>

      <TabLinkPanel>
        {activeTab === TAB_OVERVIEW && (
          <>
            <TotalStats courseId={courseId} />
            <StudentsStartingTheCourseChart courseId={courseId} />
            <CompletionsChart courseId={courseId} />
            <CourseUsersCountsByExercise courseId={courseId} />
          </>
        )}

        {activeTab === TAB_USER_ACTIVITY && (
          <>
            <CourseUsersWithSubmissionsByDay courseId={courseId} />
            <CourseSubmissionsByDay courseId={courseId} />
            <CourseSubmissionsByWeekdayAndHour courseId={courseId} />
            <FirstSubmissionTrends courseId={courseId} />
            <MonthlyUsersReturningExercises courseId={courseId} />
            <AverageTimeToSubmit courseId={courseId} />
            <CohortProgress courseId={courseId} />
          </>
        )}

        {activeTab === TAB_VISITORS && (
          <>
            <StatHeading>{t("stats-heading-visitor-metrics")}</StatHeading>
            <InstructionBox>{t("stats-instruction-visitor-metrics")}</InstructionBox>
            <CourseVisitorsByDay courseId={courseId} />

            <StatHeading>{t("stats-heading-geographic-distribution")}</StatHeading>
            <InstructionBox>{t("stats-instruction-geographic-distribution")}</InstructionBox>
            <CourseVisitorsByCountry courseId={courseId} />

            <StatHeading>{t("stats-heading-device-analytics")}</StatHeading>
            <InstructionBox>{t("stats-instruction-device-analytics")}</InstructionBox>
            <DeviceTypes courseId={courseId} />

            <StatHeading>{t("stats-heading-page-popularity")}</StatHeading>
            <InstructionBox>{t("stats-instruction-page-popularity")}</InstructionBox>
            <MostVisitedPages courseId={courseId} />

            <StatHeading>{t("stats-heading-referrers")}</StatHeading>
            <InstructionBox>{t("stats-instruction-referrers")}</InstructionBox>
            <TopReferrers courseId={courseId} />

            <StatHeading>{t("header-utm-sources")}</StatHeading>
            <InstructionBox>{t("stats-instruction-utm-sources")}</InstructionBox>
            <TopUtmSources courseId={courseId} />

            <StatHeading>{t("header-utm-campaigns")}</StatHeading>
            <InstructionBox>{t("stats-instruction-utm-campaigns")}</InstructionBox>
            <TopUtmCampaigns courseId={courseId} />

            <StatHeading>{t("stats-heading-utm-traffic-details")}</StatHeading>
            <InstructionBox>{t("stats-instruction-utm-traffic-details")}</InstructionBox>
            <DailyVisitCountsGroupedByUtm courseId={courseId} />
            <DailyVisitCountsGroupedByReferrer courseId={courseId} />
          </>
        )}
      </TabLinkPanel>
    </>
  )
}

export default CourseStatsPage
