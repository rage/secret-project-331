import React from "react"
import { QueryObserverResult } from "react-query"

import { ExerciseService } from "../../../../shared-module/bindings"

import ExerciseServiceCard from "./ExerciseServiceCard"

interface ExerciseServiceEditorProps {
  exercise_services: ExerciseService[]
  refetch(): Promise<QueryObserverResult<ExerciseService[], unknown>>
}

const ExerciseServiceContainer: React.FC<ExerciseServiceEditorProps> = ({
  exercise_services,
  refetch,
}) => (
  <div>
    {exercise_services.map((service) => (
      <ExerciseServiceCard key={service.id} exercise_service={service} refetch={refetch} />
    ))}
  </div>
)

export default ExerciseServiceContainer
