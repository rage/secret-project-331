import { List, ListItem, Typography, ListItemIcon, ListItemText } from '@material-ui/core'
import InboxIcon from '@material-ui/icons/Inbox'

const exerciseItemTypes = ['Quizzes', 'Test My Code']

const ExerciseServiceList = () => {
  return (
    <div>
      <Typography>Please select a exercise type:</Typography>
      <List>
        {exerciseItemTypes.map((eit) => (
          <ListItem button>{eit}</ListItem>
        ))}
      </List>
    </div>
  )
}

export default ExerciseServiceList
