import { css } from "@emotion/css"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import GlobalStatTable from "../components/page-specific/global-stats/GlobalStatTable"
import {
  useCourseModuleStatsByCompletionsRegisteredToStudyRegistryQuery,
  useNumberOfPeopleCompletedACourseQuery,
  useNumberOfPeopleDoneAtLeastOneExerciseQuery,
  useNumberOfPeopleRegisteredCompletionToStudyRegistryQuery,
  useNumberOfPeopleStartedCourseQuery,
} from "../hooks/globalStats"

import { TimeGranularity } from "@/shared-module/common/bindings"
import SelectMenu from "@/shared-module/common/components/SelectMenu"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"

const YEAR_GRANULARITY = "Year"
const MONTH_GRANULARITY = "Month"

const StatsPage = () => {
  const { t } = useTranslation()
  const [granularity, setGranularity] = useState<TimeGranularity>(YEAR_GRANULARITY)

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

          select {
            min-height: 35px;
            font-size: 14px;
          }

          label {
            text-align: right;
          }
        }
      `}
    >
      <h1>{t("link-stats")}</h1>
      <SelectMenu
        id="granularity-select"
        className="granularity-select"
        label={t("time-granularity")}
        value={granularity}
        onChange={(e) => setGranularity(e.target.value as TimeGranularity)}
        options={[
          { value: YEAR_GRANULARITY, label: t("year") },
          { value: MONTH_GRANULARITY, label: t("month") },
        ]}
        showDefaultOption={false}
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

export default withSignedIn(StatsPage)
