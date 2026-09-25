"use client"

import React from "react"

import { useCreditRegistrationEnrolmentChecks } from "@/components/credit-registration/admin/adminCreditRegistrationHooks"
import EnrolmentCheckCostSection from "@/components/credit-registration/admin/EnrolmentCheckCostSection"
import EnrolmentCheckLatenessSection from "@/components/credit-registration/admin/EnrolmentCheckLatenessSection"
import EnrolmentCheckOutcomesSection from "@/components/credit-registration/admin/EnrolmentCheckOutcomesSection"
import EnrolmentCheckPopulationSection from "@/components/credit-registration/admin/EnrolmentCheckPopulationSection"
import {
  DaysWindowSelect,
  useDaysParam,
  WEEK_OPTION_DAYS,
} from "@/components/credit-registration/admin/WindowSecsSelect"
import { QUIET_REFRESH } from "@/components/credit-registration/constants"
import { controlCss, controlsCss, sectionCardsCss } from "@/components/credit-registration/styles"
import { QueryResult } from "@/shared-module/components"

/** Lateness, cost, population and findings of the enrolment check pacing, over one shared window. */
const EnrolmentChecksPage: React.FC = () => {
  const { control, days } = useDaysParam(WEEK_OPTION_DAYS)
  const dashboardQuery = useCreditRegistrationEnrolmentChecks(days)

  return (
    <div className={sectionCardsCss}>
      <div className={controlsCss}>
        <div className={controlCss}>
          <DaysWindowSelect control={control} />
        </div>
      </div>
      <QueryResult
        query={dashboardQuery}
        refreshIndicator={QUIET_REFRESH}
        contentClassName={sectionCardsCss}
      >
        {(dashboard) => (
          <>
            <EnrolmentCheckLatenessSection
              rows={dashboard.lateness}
              veryLateAfterSecs={dashboard.very_late_after_secs}
            />
            <EnrolmentCheckCostSection
              dailyCosts={dashboard.daily_costs}
              rosterCodes={dashboard.roster_codes}
              rateLimits={dashboard.rate_limits}
            />
            <EnrolmentCheckPopulationSection rows={dashboard.population} />
            <EnrolmentCheckOutcomesSection rows={dashboard.findings} />
          </>
        )}
      </QueryResult>
    </div>
  )
}

export default EnrolmentChecksPage
