import { List, ListItem } from "@material-ui/core"

import { normalWidthCenteredComponentStyles } from "../../../shared-module/styles/componentStyles"

export interface ExerciseTaskTypes {
  name: string
  url: null | string
  identifier: string
}
// Fetch iFrame exercise types from an endpoint?
export const exerciseTaskTypes: ExerciseTaskTypes[] = [
  { name: "Quizzes", url: "/quizzes/editor", identifier: "quizzes" },
  { name: "Test My Code", url: null, identifier: "tmc" },
  { name: "Example Exercise", url: "/example-exercise/editor", identifier: "example-exercise" },
]

interface Props {
  onChooseItem: (task: ExerciseTaskTypes) => void
}

const ExerciseServiceList: React.FC<Props> = ({ onChooseItem }) => {
  return (
    <div className={normalWidthCenteredComponentStyles}>
      <h2>Please select an exercise type:</h2>
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
