import { List, ListItem, Typography } from '@material-ui/core'

// Fetch iFrame exercise types from an endpoint?
export const exerciseItemTypes = [
  { name: 'Quizzes', url: null, identifier: 'quizzes' },
  { name: 'Test My Code', url: null, identifier: 'tmc' },
  { name: 'Example Exercise', url: '/example-exercise/editor', identifier: 'example' },
]

const ExerciseServiceList = ({ onChooseItem }) => {
  return (
    <div>
      <Typography>Please select an exercise type:</Typography>
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
