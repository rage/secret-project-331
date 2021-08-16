import {
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@material-ui/core"
import InfoIcon from "@material-ui/icons/Info"
import React from "react"
import { useQuery } from "react-query"

import Layout from "../../components/Layout"
import { fetchExerciseServices } from "../../services/backend/exercise-services"
import Button from "../../shared-module/components/Button"

interface ExerciseService {
  id: string
  name: string
  slug: string
  public_url: string
  internal_url: string
  max_reprocessing_submissions_at_once: number
}

interface ExerciseServiceEditorProps {
  exercise_services: ExerciseService[]
}

const ExerciseServiceTable: React.FC<ExerciseServiceEditorProps> = ({ exercise_services }) => (
  <TableContainer component={Paper}>
    <Table>
      <TableHead>
        <TableRow>
          <TableCell>Name</TableCell>
          <TableCell>Slug</TableCell>
          <TableCell>Public URL</TableCell>
          <TableCell>Internal URL</TableCell>
          <TableCell>Reprocessing submissions</TableCell>
          <TableCell></TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {exercise_services.map((exercise_service) => (
          <TableRow key={exercise_service.id}>
            <TableCell component="th" scope="row">
              {exercise_service.name}
            </TableCell>
            <TableCell>{exercise_service.slug}</TableCell>
            <TableCell>{exercise_service.public_url}</TableCell>
            <TableCell>{exercise_service.internal_url}</TableCell>
            <TableCell>{exercise_service.max_reprocessing_submissions_at_once}</TableCell>
            <TableCell>
              <IconButton component="span">
                <InfoIcon />
              </IconButton>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </TableContainer>
)

const ExerciseServicePage: React.FC<ExerciseServiceEditorProps> = () => {
  const { isLoading, error, data, refetch } = useQuery(`exercise-services`, () =>
    fetchExerciseServices(),
  )

  if (error) {
    return <div>Error fetching exercise services.</div>
  }

  if (isLoading || !data) {
    return <div>Loading...</div>
  }

  return (
    <Layout>
      <h1> Manage exercise services:</h1>
      <ExerciseServiceTable exercise_services={data} />
      <br />
      <Button variant="primary" size="medium">
        Add new service
      </Button>
    </Layout>
  )
}

export default ExerciseServicePage
