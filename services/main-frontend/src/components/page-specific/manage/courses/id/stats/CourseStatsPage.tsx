import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { useRouter } from "next/router"
import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { CourseManagementPagesProps } from "../../../../../../pages/manage/courses/[id]/[...path]"

import CourseSubmissionsByDay from "./CourseSubmissionsByDay"
import CourseSubmissionsByWeekdayAndHour from "./CourseSubmissionsByWeekdayAndHour"
import CourseUsersCountsByExercise from "./CourseUsersCountsByExercise"
import CourseUsersWithSubmissionsByDay from "./CourseUsersWithSubmissionsByDay"
import CourseVisitorsByCountry from "./CourseVisitorsByCountry"
import CourseVisitorsByDay from "./CourseVisitorsByDay"
import DailyVisitCountsGroupedByReferrer from "./DailyVisitCountsGroupedByReferrer"
import DailyVisitCountsGroupedByUtm from "./DailyVisitCountsGroupedByUtm"
import DeviceTypes from "./DeviceTypes"
import MostVisitedPages from "./MostVisitedPages"
import TopReferrers from "./TopReferrers"
import TopUtmCampaigns from "./TopUtmCampaigns"
import TopUtmSources from "./TopUtmSources"

import TabLink from "@/shared-module/common/components/Navigation/TabLinks/TabLink"
import TabLinkNavigation from "@/shared-module/common/components/Navigation/TabLinks/TabLinkNavigation"
import TabLinkPanel from "@/shared-module/common/components/Navigation/TabLinks/TabLinkPanel"
import { baseTheme, headingFont } from "@/shared-module/common/styles"

const StatHeading = styled.h2`
  font-size: 1.8rem;
  color: ${baseTheme.colors.gray[600]};
  font-family: ${headingFont};
  margin-bottom: 1rem;
`

const InstructionBox = styled.div`
  background-color: ${baseTheme.colors.clear[100]};
  border-left: 4px solid ${baseTheme.colors.blue[600]};
  padding: 1rem;
  margin-bottom: 2rem;
  border-radius: 4px;
  color: ${baseTheme.colors.gray[600]};
  font-size: 0.9rem;
  line-height: 1.5;
`

// Define tab categories as constants
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
            <StatHeading>{t("stats-heading-total-users")}</StatHeading>
            <InstructionBox>{t("stats-instruction-total-users")}</InstructionBox>
            {/* TODO: Add TotalUsers component */}

            <StatHeading>{t("stats-heading-total-completions")}</StatHeading>
            <InstructionBox>{t("stats-instruction-total-completions")}</InstructionBox>
            {/* TODO: Add TotalCompletions component */}

            <StatHeading>{t("stats-heading-monthly-completions")}</StatHeading>
            <InstructionBox>{t("stats-instruction-monthly-completions")}</InstructionBox>
            {/* TODO: Add MonthlyCompletions component */}

            <StatHeading>{t("stats-heading-daily-completions")}</StatHeading>
            <InstructionBox>{t("stats-instruction-daily-completions")}</InstructionBox>
            {/* TODO: Add DailyCompletions component */}

            <StatHeading>{t("stats-heading-exercise-participation")}</StatHeading>
            <InstructionBox>{t("stats-instruction-exercise-participation")}</InstructionBox>
            <CourseUsersCountsByExercise courseId={courseId} />
          </>
        )}

        {activeTab === TAB_USER_ACTIVITY && (
          <>
            <StatHeading>{t("stats-heading-unique-users-by-week")}</StatHeading>
            <InstructionBox>{t("stats-instruction-unique-users-by-week")}</InstructionBox>
            {/* TODO: Add WeeklyUniqueUsers component */}

            <StatHeading>{t("stats-heading-unique-users-by-month")}</StatHeading>
            <InstructionBox>{t("stats-instruction-unique-users-by-month")}</InstructionBox>
            {/* TODO: Add MonthlyUniqueUsers component */}

            <StatHeading>{t("stats-heading-unique-users-by-day")}</StatHeading>
            <InstructionBox>{t("stats-instruction-unique-users-by-day")}</InstructionBox>
            {/* TODO: Add DailyUniqueUsers component */}

            <StatHeading>{t("stats-heading-users-with-submissions")}</StatHeading>
            <InstructionBox>{t("stats-instruction-users-with-submissions")}</InstructionBox>
            <CourseUsersWithSubmissionsByDay courseId={courseId} />

            <StatHeading>{t("stats-heading-daily-submissions")}</StatHeading>
            <InstructionBox>{t("stats-instruction-daily-submissions")}</InstructionBox>
            <CourseSubmissionsByDay courseId={courseId} />

            <StatHeading>{t("stats-heading-submission-timing")}</StatHeading>
            <InstructionBox>{t("stats-instruction-submission-timing")}</InstructionBox>
            <CourseSubmissionsByWeekdayAndHour courseId={courseId} />

            <StatHeading>{t("stats-heading-first-submission-trends")}</StatHeading>
            <InstructionBox>{t("stats-instruction-first-submission-trends")}</InstructionBox>
            {/* TODO: Add FirstSubmissionTrends component */}

            <StatHeading>{t("stats-heading-returning-users-monthly")}</StatHeading>
            <InstructionBox>{t("stats-instruction-returning-users-monthly")}</InstructionBox>
            {/* TODO: Add MonthlyReturningUsers component */}

            <StatHeading>{t("stats-heading-average-time-to-submit")}</StatHeading>
            <InstructionBox>{t("stats-instruction-average-time-to-submit")}</InstructionBox>
            {/* TODO: Add AverageTimeToSubmit component */}

            <StatHeading>{t("stats-heading-weekly-cohort-progress")}</StatHeading>
            <InstructionBox>{t("stats-instruction-weekly-cohort-progress")}</InstructionBox>
            {/* TODO: Add WeeklyCohortProgress component */}

            <StatHeading>{t("stats-heading-daily-cohort-progress")}</StatHeading>
            <InstructionBox>{t("stats-instruction-daily-cohort-progress")}</InstructionBox>
            {/* TODO: Add DailyCohortProgress component */}
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
