import React from "react"

import ExerciseEditor from "../../../components/editors/ExerciseEditor"
import useQueryParameter from "../../../shared-module/hooks/useQueryParameter"

const Exercise = () => {
  const exerciseId = useQueryParameter("id")

  if (!exerciseId) {
    return <p>loading...</p>
  }

  return <ExerciseEditor id={exerciseId} />
}

export default Exercise
