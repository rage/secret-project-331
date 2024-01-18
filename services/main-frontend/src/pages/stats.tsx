import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import GlobalStatTable from "../components/page-specific/global-stats/GlobalStatTable"
import {
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
  return (
    <div
      className={css`
        h2 {
          margin-bottom: -3rem;
          margin-top: 2rem;
        }
      `}
    >
      <h1>{t("link-stats")}</h1>
      <h2>{t("heading-number-of-people-started-course")}</h2>
      <GlobalStatTable query={numberOfPeopleStartedCourseQuery} />
      <h2>{t("heading-number-of-people-done-at-least-one-exercise")}</h2>
      <GlobalStatTable query={numberOfPeopleDoneAtLeastOneExerciseQuery} />
      <h2>{t("heading-number-of-people-completed-course")}</h2>
      <GlobalStatTable query={numberOfPeopleComplatedACourseQuery} />
      <h2>{t("heading-number-of-people-registered-completion-to-study-registry")}</h2>
      <GlobalStatTable query={numberOfPeopleRegisteredCompletionToStudyRegistryQuery} />
    </div>
  )
}

export default withSignedIn(StatsPage)
