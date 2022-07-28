import { List, ListItem } from "@mui/material"
import { useTranslation } from "react-i18next"
export interface ExerciseTaskTypes {
  name: string
  url: null | string
  identifier: string
}
// Fetch iFrame exercise types from an endpoint?
export const exerciseTaskTypes: ExerciseTaskTypes[] = [
  // eslint-disable-next-line i18next/no-literal-string
  { name: "Quizzes", url: "/quizzes/iframe", identifier: "quizzes" },
  // eslint-disable-next-line i18next/no-literal-string
  { name: "Test My Code", url: null, identifier: "tmc" },
  // eslint-disable-next-line i18next/no-literal-string
  { name: "Example Exercise", url: "/example-exercise/iframe", identifier: "example-exercise" },
]

interface Props {
  onChooseItem: (task: ExerciseTaskTypes) => void
}

const ExerciseServiceList: React.FC<React.PropsWithChildren<Props>> = ({ onChooseItem }) => {
  const { t } = useTranslation()
  return (
    <div>
      <h2>{t("please-select-exercise-type")}</h2>
      <List>
        {exerciseTaskTypes.map((eit) => (
          <ListItem
            key={eit.name}
            onClick={() => {
              if (!eit.url) {
                return
              }
              onChooseItem(eit)
            }}
            button
          >
            {eit.name}
          </ListItem>
        ))}
      </List>
    </div>
  )
}

export default ExerciseServiceList
