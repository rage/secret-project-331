import { Dialog, DialogTitle, List, ListItem, Typography } from '@material-ui/core'
import { Button } from '@material-ui/core'
import { useState } from 'react'
import styled from 'styled-components'
import ExerciseServiceList from './ExerciseServiceList'
const ChooseExerciseItemTypeWrapper = styled.div`
  margin-top: 1rem;
`

const ChooseExerciseItemType = () => {
  const [dialogOpen, setDialogOpen] = useState(false)
  return <ExerciseServiceList />
}

export default ChooseExerciseItemType
