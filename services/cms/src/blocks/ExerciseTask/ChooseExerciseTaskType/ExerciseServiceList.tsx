import { List, ListItem } from "@mui/material"
import { useTranslation } from "react-i18next"

import useAllExerciseServices from "../../../hooks/useAllExerciseServices"
import { ExerciseServiceIframeRenderingInfo } from "../../../shared-module/bindings"
import ErrorBanner from "../../../shared-module/components/ErrorBanner"
import Spinner from "../../../shared-module/components/Spinner"

interface Props {
  onChooseItem: (task: ExerciseServiceIframeRenderingInfo) => void
}

const ExerciseServiceList: React.FC<React.PropsWithChildren<Props>> = ({ onChooseItem }) => {
  const exerciseServicesQuery = useAllExerciseServices()
  const { t } = useTranslation()

  if (exerciseServicesQuery.isError) {
    return <ErrorBanner variant={"readOnly"} error={exerciseServicesQuery.error} />
  }

  if (exerciseServicesQuery.isLoading) {
    return <Spinner variant="medium" />
  }
  return (
    <div>
      <h2>{t("please-select-exercise-type")}</h2>
      <List>
        {exerciseServicesQuery.data.map((exercise_service) => (
          <ListItem
            key={exercise_service.name}
            onClick={() => {
              if (!exercise_service.public_iframe_url) {
                return
              }
              onChooseItem(exercise_service)
            }}
            button
          >
            {exercise_service.name}
          </ListItem>
        ))}
      </List>
    </div>
  )
}

export default ExerciseServiceList
