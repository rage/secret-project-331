"use client"
import React from "react"

import CourseVisitorsByCountry from "../../visualizations/visitors/CourseVisitorsByCountry"
import CourseVisitorsByDay from "../../visualizations/visitors/CourseVisitorsByDay"
import CourseVisitorsLineChart from "../../visualizations/visitors/CourseVisitorsLineChart"
import DailyVisitCountsGroupedByReferrer from "../../visualizations/visitors/DailyVisitCountsGroupedByReferrer"
import DailyVisitCountsGroupedByUtm from "../../visualizations/visitors/DailyVisitCountsGroupedByUtm"
import DeviceTypes from "../../visualizations/visitors/DeviceTypes"
import MostVisitedPages from "../../visualizations/visitors/MostVisitedPages"
import TopReferrers from "../../visualizations/visitors/TopReferrers"
import TopUtmCampaigns from "../../visualizations/visitors/TopUtmCampaigns"
import TopUtmSources from "../../visualizations/visitors/TopUtmSources"

interface VisitorsTabProps {
  courseId: string
}

const VisitorsTab: React.FC<VisitorsTabProps> = ({ courseId }) => {
  return (
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
  )
}

export default VisitorsTab
