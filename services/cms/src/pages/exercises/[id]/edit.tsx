import React from "react"
import { useQuery } from "react-query"

import { getExerciseById } from "../../../services/backend/exercises"

interface ExerciseEditorProps {
  id: string
}

const ExerciseEditor: React.FC<ExerciseEditorProps> = ({ id }) => {
  const { isLoading, error, data } = useQuery(`edit-exercise-${id}`, () => getExerciseById(id))
  if (error) {
    return <pre>{JSON.stringify(error, undefined, 2)}</pre>
  }
  if (isLoading || !data) {
    return <p>loading...</p>
  }
  return <pre>{JSON.stringify(data, undefined, 2)}</pre>
}

export default ExerciseEditor
