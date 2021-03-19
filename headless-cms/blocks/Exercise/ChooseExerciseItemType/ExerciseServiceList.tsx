import { List, ListItem, Typography, ListItemIcon, ListItemText } from '@material-ui/core'
import InboxIcon from '@material-ui/icons/Inbox'

const exerciseItemTypes = [
  { name: 'Quizzes', url: null },
  { name: 'Test My Code', url: null },
  { name: 'Example Exercise', url: 'http://localhost:3002/editor' },
]

const ExerciseServiceList = ({ onChooseItem }) => {
  return (
    <div>
      <Typography>Please select a exercise type:</Typography>
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
