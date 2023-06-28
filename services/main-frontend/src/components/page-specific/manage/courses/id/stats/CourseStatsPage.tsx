import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import { CourseManagementPagesProps } from "../../../../../../pages/manage/courses/[id]/[...path]"
import { baseTheme, headingFont } from "../../../../../../shared-module/styles"
import withErrorBoundary from "../../../../../../shared-module/utils/withErrorBoundary"

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

const StatHeading = styled.h2`
  font-size: 1.8rem;
  color: ${baseTheme.colors.gray[600]};
  font-family: ${headingFont};
  margin-bottom: 1rem;
`

const CourseStatsPage: React.FC<React.PropsWithChildren<CourseManagementPagesProps>> = ({
  courseId,
}) => {
  const { t } = useTranslation()
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
      <StatHeading>{t("title-course-users-counts-by-exercise")}</StatHeading>
      <CourseUsersCountsByExercise courseId={courseId} />
      <StatHeading>{t("title-number-of-users-with-submissions-per-day")}</StatHeading>
      <CourseUsersWithSubmissionsByDay courseId={courseId} />
      <StatHeading>{t("title-number-of-submissions-per-day")}</StatHeading>
      <CourseSubmissionsByDay courseId={courseId} />
      <StatHeading>{t("header-visitors-per-day")}</StatHeading>
      <CourseVisitorsByDay courseId={courseId} />
      <StatHeading>{t("title-number-of-submissions-per-weekday-and-hour")}</StatHeading>
      <CourseSubmissionsByWeekdayAndHour courseId={courseId} />
      <StatHeading>{t("header-course-visitors-by-country")}</StatHeading>
      <CourseVisitorsByCountry courseId={courseId} />
      <StatHeading>{t("header-most-visited-pages")}</StatHeading>
      <MostVisitedPages courseId={courseId} />
      <StatHeading>{t("header-referrers")}</StatHeading>
      <TopReferrers courseId={courseId} />
      <StatHeading>{t("header-devices")}</StatHeading>
      <DeviceTypes courseId={courseId} />
      <StatHeading>{t("header-utm-sources")}</StatHeading>
      <TopUtmSources courseId={courseId} />
      <StatHeading>{t("header-utm-campaigns")}</StatHeading>
      <TopUtmCampaigns courseId={courseId} />
      <StatHeading>{t("header-dailty-visit-counts")}</StatHeading>
      <DailyVisitCountsGroupedByUtm courseId={courseId} />
      <DailyVisitCountsGroupedByReferrer courseId={courseId} />
    </>
  )
}

export default CourseStatsPage
