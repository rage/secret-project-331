import { List, ListItem } from "@material-ui/core"

export interface ExerciseItemTypes {
  name: string
  url: null | string
  identifier: string
}
// Fetch iFrame exercise types from an endpoint?
export const exerciseItemTypes: ExerciseItemTypes[] = [
  { name: "Quizzes", url: null, identifier: "quizzes" },
  { name: "Test My Code", url: null, identifier: "tmc" },
  { name: "Example Exercise", url: "/example-exercise/editor", identifier: "example" },
]

interface Props {
  onChooseItem: (item: ExerciseItemTypes) => void
}

const ExerciseServiceList: React.FC<Props> = ({ onChooseItem }) => {
  return (
    <div>
      <h2>Please select an exercise type:</h2>
      <List>
        {exerciseItemTypes.map((eit) => (
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
