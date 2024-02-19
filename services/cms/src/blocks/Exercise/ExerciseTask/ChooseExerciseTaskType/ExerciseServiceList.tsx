import { css } from "@emotion/css"
import { useTranslation } from "react-i18next"

import useAllExerciseServices from "../../../../hooks/useAllExerciseServices"
import { ExerciseServiceIframeRenderingInfo } from "../../../../shared-module/bindings"
import Button from "../../../../shared-module/components/Button"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../shared-module/components/Spinner"

interface Props {
  onChooseItem: (task: ExerciseServiceIframeRenderingInfo) => void
}

const ExerciseServiceList: React.FC<React.PropsWithChildren<Props>> = ({ onChooseItem }) => {
  const exerciseServicesQuery = useAllExerciseServices()
  const { t } = useTranslation()

  if (exerciseServicesQuery.isError) {
    return <ErrorBanner variant={"readOnly"} error={exerciseServicesQuery.error} />
  }

  if (exerciseServicesQuery.isPending) {
    return <Spinner variant="medium" />
  }

  return (
    <div>
      <h2>{t("please-select-exercise-type")}</h2>
      <ul
        className={css`
          list-style: none;
          padding: 0;

          li {
            margin: 0.5rem 0;
          }
        `}
      >
        {exerciseServicesQuery.data.map((exercise_service) => (
          <li key={exercise_service.name}>
            <Button
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                if (!exercise_service.public_iframe_url) {
                  return
                }
                onChooseItem(exercise_service)
              }}
              variant="outlined"
              size="medium"
            >
              {exercise_service.name}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default ExerciseServiceList
