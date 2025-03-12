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
            {/* TODO: Add TotalUsers component */}

            <StatHeading>{t("stats-heading-total-completions")}</StatHeading>
            {/* TODO: Add TotalCompletions component */}

            <StatHeading>{t("stats-heading-monthly-completions")}</StatHeading>
            {/* TODO: Add MonthlyCompletions component */}

            <StatHeading>{t("stats-heading-daily-completions")}</StatHeading>
            {/* TODO: Add DailyCompletions component */}

            <StatHeading>{t("stats-heading-exercise-participation")}</StatHeading>
            <CourseUsersCountsByExercise courseId={courseId} />
          </>
        )}

        {activeTab === TAB_USER_ACTIVITY && (
          <>
            <StatHeading>{t("stats-heading-unique-users-by-week")}</StatHeading>
            {/* TODO: Add WeeklyUniqueUsers component */}

            <StatHeading>{t("stats-heading-unique-users-by-month")}</StatHeading>
            {/* TODO: Add MonthlyUniqueUsers component */}

            <StatHeading>{t("stats-heading-unique-users-by-day")}</StatHeading>
            {/* TODO: Add DailyUniqueUsers component */}

            <StatHeading>{t("stats-heading-users-with-submissions")}</StatHeading>
            <CourseUsersWithSubmissionsByDay courseId={courseId} />

            <StatHeading>{t("stats-heading-daily-submissions")}</StatHeading>
            <CourseSubmissionsByDay courseId={courseId} />

            <StatHeading>{t("stats-heading-submission-timing")}</StatHeading>
            <CourseSubmissionsByWeekdayAndHour courseId={courseId} />

            <StatHeading>{t("stats-heading-first-submission-trends")}</StatHeading>
            {/* TODO: Add FirstSubmissionTrends component */}

            <StatHeading>{t("stats-heading-returning-users-monthly")}</StatHeading>
            {/* TODO: Add MonthlyReturningUsers component */}

            <StatHeading>{t("stats-heading-average-time-to-submit")}</StatHeading>
            {/* TODO: Add AverageTimeToSubmit component */}

            <StatHeading>{t("stats-heading-weekly-cohort-progress")}</StatHeading>
            {/* TODO: Add WeeklyCohortProgress component */}

            <StatHeading>{t("stats-heading-daily-cohort-progress")}</StatHeading>
            {/* TODO: Add DailyCohortProgress component */}
          </>
        )}

        {activeTab === TAB_VISITORS && (
          <>
            <StatHeading>{t("stats-heading-visitor-metrics")}</StatHeading>
            <CourseVisitorsByDay courseId={courseId} />

            <StatHeading>{t("stats-heading-geographic-distribution")}</StatHeading>
            <CourseVisitorsByCountry courseId={courseId} />

            <StatHeading>{t("stats-heading-device-analytics")}</StatHeading>
            <DeviceTypes courseId={courseId} />

            <StatHeading>{t("stats-heading-page-popularity")}</StatHeading>
            <MostVisitedPages courseId={courseId} />

            <StatHeading>{t("stats-heading-referrers")}</StatHeading>
            <TopReferrers courseId={courseId} />

            <StatHeading>{t("header-utm-sources")}</StatHeading>
            <TopUtmSources courseId={courseId} />

            <StatHeading>{t("header-utm-campaigns")}</StatHeading>
            <TopUtmCampaigns courseId={courseId} />

            <StatHeading>{t("stats-heading-utm-traffic-details")}</StatHeading>
            <DailyVisitCountsGroupedByUtm courseId={courseId} />
            <DailyVisitCountsGroupedByReferrer courseId={courseId} />
          </>
        )}
      </TabLinkPanel>
    </>
  )
}

export default CourseStatsPage
