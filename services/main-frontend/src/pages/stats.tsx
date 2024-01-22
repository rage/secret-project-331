import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import GlobalStatTable from "../components/page-specific/global-stats/GlobalStatTable"
import {
  getCourseModuleStatsByCompletionsRegisteredToStudyRegistry,
  getNumberOfPeopleCompletedACourse,
  getNumberOfPeopleDoneAtLeastOneExercise,
  getNumberOfPeopleRegisteredCompletionToStudyRegistry,
  getnumberOfPeopleStartedCourse,
} from "../services/backend/global-stats"
import { withSignedIn } from "../shared-module/contexts/LoginStateContext"

const StatsPage = () => {
  const { t } = useTranslation()
  const numberOfPeopleComplatedACourseQuery = useQuery({
    queryKey: ["numberOfPeopleComplatedACourse"],
    queryFn: getNumberOfPeopleCompletedACourse,
  })
  const numberOfPeopleRegisteredCompletionToStudyRegistryQuery = useQuery({
    queryKey: ["numberOfPeopleRegisteredCompletionToStudyRegistry"],
    queryFn: getNumberOfPeopleRegisteredCompletionToStudyRegistry,
  })
  const numberOfPeopleDoneAtLeastOneExerciseQuery = useQuery({
    queryKey: ["numberOfPeopleDoneAtLeastOneExercise"],
    queryFn: getNumberOfPeopleDoneAtLeastOneExercise,
  })
  const numberOfPeopleStartedCourseQuery = useQuery({
    queryKey: ["numberOfPeopleStartedCourse"],
    queryFn: getnumberOfPeopleStartedCourse,
  })
  const courseModuleStatsByCompletionsReqisteredToStudyRegistryQuery = useQuery({
    queryKey: ["courseModuleStatsByCompletionsReqisteredToStudyRegistry"],
    queryFn: getCourseModuleStatsByCompletionsRegisteredToStudyRegistry,
  })
  return (
    <div
      className={css`
        h2 {
          margin-top: 2rem;
        }
      `}
    >
      <h1>{t("link-stats")}</h1>
      <h2>{t("heading-number-of-people-started-course")}</h2>
      <GlobalStatTable query={numberOfPeopleStartedCourseQuery} moduleStats={false} />
      <h2>{t("heading-number-of-people-done-at-least-one-exercise")}</h2>
      <GlobalStatTable query={numberOfPeopleDoneAtLeastOneExerciseQuery} moduleStats={false} />
      <h2>{t("heading-number-of-people-completed-course")}</h2>
      <GlobalStatTable query={numberOfPeopleComplatedACourseQuery} moduleStats={false} />
      <h2>{t("heading-number-of-people-registered-completion-to-study-registry")}</h2>
      <GlobalStatTable
        query={numberOfPeopleRegisteredCompletionToStudyRegistryQuery}
        moduleStats={false}
      />
      <h2>{t("heading-estimated-number-of-ects-credits")}</h2>
      <p>{t("estimated-number-of-ects-credits-warning")}</p>
      <GlobalStatTable
        query={courseModuleStatsByCompletionsReqisteredToStudyRegistryQuery}
        moduleStats={true}
      />
    </div>
  )
}

export default withSignedIn(StatsPage)
