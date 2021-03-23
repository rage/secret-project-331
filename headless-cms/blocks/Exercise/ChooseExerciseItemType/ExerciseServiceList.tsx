import { List, ListItem, Typography } from '@material-ui/core'

// Fetch iFrame exercise types from an endpoint?
const exerciseItemTypes = [
  { name: 'Quizzes', url: null },
  { name: 'Test My Code', url: null },
  { name: 'Example Exercise', url: 'http://localhost:3002/editor' },
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
