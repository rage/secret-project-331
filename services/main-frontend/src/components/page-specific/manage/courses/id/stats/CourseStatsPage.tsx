import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { useRouter } from "next/router"
import React, { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { CourseManagementPagesProps } from "../../../../../../pages/manage/courses/[id]/[...path]"

import AllLanguageCompletionsChart from "./visualizations/all-languages/AllLanguageCompletionsChart"
import AllLanguageStartingUsersChart from "./visualizations/all-languages/AllLanguageStartingUsersChart"
import AllLanguageTotalStats from "./visualizations/all-languages/AllLanguageTotalStats"
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
import CourseVisitorsLineChart from "./visualizations/visitors/CourseVisitorsLineChart"
import DailyVisitCountsGroupedByReferrer from "./visualizations/visitors/DailyVisitCountsGroupedByReferrer"
import DailyVisitCountsGroupedByUtm from "./visualizations/visitors/DailyVisitCountsGroupedByUtm"
import DeviceTypes from "./visualizations/visitors/DeviceTypes"
import MostVisitedPages from "./visualizations/visitors/MostVisitedPages"
import TopReferrers from "./visualizations/visitors/TopReferrers"
import TopUtmCampaigns from "./visualizations/visitors/TopUtmCampaigns"
import TopUtmSources from "./visualizations/visitors/TopUtmSources"

import useCourseLanguageVersionsQuery from "@/hooks/useCourseLanguageVersions"
import TabLink from "@/shared-module/common/components/Navigation/TabLinks/TabLink"
import TabLinkNavigation from "@/shared-module/common/components/Navigation/TabLinks/TabLinkNavigation"
import TabLinkPanel from "@/shared-module/common/components/Navigation/TabLinks/TabLinkPanel"
import { baseTheme, headingFont } from "@/shared-module/common/styles"

const TAB_OVERVIEW = "overview"
const TAB_USER_ACTIVITY = "user-activity"
const TAB_VISITORS = "visitors"
const TAB_ALL_LANGUAGES = "all-languages"

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

const CourseStatsPage: React.FC<React.PropsWithChildren<CourseManagementPagesProps>> = ({
  courseId,
}) => {
  const { t } = useTranslation()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState(TAB_OVERVIEW)

  const courseLanguageVersions = useCourseLanguageVersionsQuery(courseId)

  useEffect(() => {
    if (router.query.tab) {
      setActiveTab(router.query.tab as string)
    }
  }, [router.query.tab])

  const showLanguageVersionsTab = useMemo(
    () => courseLanguageVersions.isSuccess && courseLanguageVersions.data.length > 1,
    [courseLanguageVersions.isSuccess, courseLanguageVersions.data],
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
        {showLanguageVersionsTab && (
          <TabLink
            url={{ pathname: router.pathname, query: { ...router.query, tab: TAB_ALL_LANGUAGES } }}
            isActive={activeTab === TAB_ALL_LANGUAGES}
          >
            {t("stats-tab-all-languages")}
          </TabLink>
        )}
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
            <CourseVisitorsLineChart courseId={courseId} />
            <CourseVisitorsByDay courseId={courseId} />
            <CourseVisitorsByCountry courseId={courseId} />
            <DeviceTypes courseId={courseId} />
            <MostVisitedPages courseId={courseId} />
            <TopReferrers courseId={courseId} />
            <TopUtmSources courseId={courseId} />
            <TopUtmCampaigns courseId={courseId} />
            <DailyVisitCountsGroupedByUtm courseId={courseId} />
            <DailyVisitCountsGroupedByReferrer courseId={courseId} />
          </>
        )}

        {activeTab === TAB_ALL_LANGUAGES && (
          <div>
            <InstructionBox>{t("all-language-versions-stats-description")}</InstructionBox>

            <AllLanguageTotalStats courseId={courseId} />
            <AllLanguageStartingUsersChart courseId={courseId} />
            <AllLanguageCompletionsChart courseId={courseId} />
          </div>
        )}
      </TabLinkPanel>
    </>
  )
}

export default CourseStatsPage
