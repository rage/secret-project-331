"use client"

import { css } from "@emotion/css"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"

import type { TimeGranularity } from "@/generated/api/types.generated"
import {
  useCourseModuleStatsByCompletionsRegisteredToStudyRegistryQuery,
  useNumberOfPeopleCompletedACourseQuery,
  useNumberOfPeopleDoneAtLeastOneExerciseQuery,
  useNumberOfPeopleRegisteredCompletionToStudyRegistryQuery,
  useNumberOfPeopleStartedCourseQuery,
} from "@/hooks/globalStats"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Select } from "@/shared-module/components"

import GlobalStatTable from "./GlobalStatTable"

const YEAR_GRANULARITY = "Year"
const MONTH_GRANULARITY = "Month"
const FIELD_GRANULARITY = "granularity" as const

interface StatsFilterValues {
  granularity: TimeGranularity
}

const StatsPage = () => {
  const { t } = useTranslation()
  usePageTitle(t("title-statistics"))

  const { control: filterControl } = useForm<StatsFilterValues>({
    defaultValues: { granularity: YEAR_GRANULARITY },
  })
  const granularity = useWatch({ control: filterControl, name: FIELD_GRANULARITY })

  const numberOfPeopleComplatedACourseQuery = useNumberOfPeopleCompletedACourseQuery(granularity)
  const numberOfPeopleRegisteredCompletionToStudyRegistryQuery =
    useNumberOfPeopleRegisteredCompletionToStudyRegistryQuery(granularity)
  const numberOfPeopleDoneAtLeastOneExerciseQuery =
    useNumberOfPeopleDoneAtLeastOneExerciseQuery(granularity)
  const numberOfPeopleStartedCourseQuery = useNumberOfPeopleStartedCourseQuery(granularity)
  const courseModuleStatsByCompletionsReqisteredToStudyRegistryQuery =
    useCourseModuleStatsByCompletionsRegisteredToStudyRegistryQuery(granularity)

  return (
    <div
      className={css`
        h2 {
          margin-top: 2rem;
        }

        .granularity-select {
          width: 200px;
          margin-left: auto;
          margin-bottom: 2rem;
        }
      `}
    >
      <h1>{t("link-stats")}</h1>
      <Select
        id="granularity-select"
        className="granularity-select"
        control={filterControl}
        name={FIELD_GRANULARITY}
        label={t("time-granularity")}
        options={[
          { value: YEAR_GRANULARITY, label: t("year") },
          { value: MONTH_GRANULARITY, label: t("month") },
        ]}
      />
      <h2>{t("heading-number-of-people-started-course")}</h2>
      <GlobalStatTable
        query={numberOfPeopleStartedCourseQuery}
        moduleStats={false}
        granularity={granularity}
      />
      <h2>{t("heading-number-of-people-done-at-least-one-exercise")}</h2>
      <GlobalStatTable
        query={numberOfPeopleDoneAtLeastOneExerciseQuery}
        moduleStats={false}
        granularity={granularity}
      />
      <h2>{t("heading-number-of-people-completed-course")}</h2>
      <GlobalStatTable
        query={numberOfPeopleComplatedACourseQuery}
        moduleStats={false}
        granularity={granularity}
      />
      <h2>{t("heading-number-of-people-registered-completion-to-study-registry")}</h2>
      <GlobalStatTable
        query={numberOfPeopleRegisteredCompletionToStudyRegistryQuery}
        moduleStats={false}
        granularity={granularity}
      />
      <h2>{t("heading-estimated-number-of-ects-credits")}</h2>
      <p>{t("estimated-number-of-ects-credits-warning")}</p>
      <GlobalStatTable
        query={courseModuleStatsByCompletionsReqisteredToStudyRegistryQuery}
        moduleStats={true}
        granularity={granularity}
      />
    </div>
  )
}

export default withErrorBoundary(withSignedIn(StatsPage))
