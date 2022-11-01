import { QueryObserverResult } from "@tanstack/react-query"
import React from "react"

import { ExerciseService } from "../../../../shared-module/bindings"

import ExerciseServiceCard from "./ExerciseServiceCard"

interface ExerciseServiceEditorProps {
  exerciseServices: ExerciseService[]
  refetch(): Promise<QueryObserverResult<ExerciseService[], unknown>>
}

const ExerciseServiceContainer: React.FC<React.PropsWithChildren<ExerciseServiceEditorProps>> = ({
  exerciseServices,
  refetch,
}) => (
  <div>
    {exerciseServices.map((service) => (
      <ExerciseServiceCard
        key={service.id}
        id={service.id}
        exerciseService={service}
        refetch={refetch}
      />
    ))}
  </div>
)

export default ExerciseServiceContainer
