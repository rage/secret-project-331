import React from "react"

import HeightTrackingContainer from "../shared-module/components/HeightTrackingContainer"

import ExerciseBase from "./ExerciseBase"

interface SubmissionProps {
  port: MessagePort
  maxWidth: number
  state: any
}

const Submission: React.FC<SubmissionProps> = ({ port, maxWidth, state }) => {
  return (
    <HeightTrackingContainer port={port}>
      <ExerciseBase
        alternatives={state.public_spec}
        model_solutions={state.model_solution_spec}
        selectedId={state.submission_data}
        maxWidth={maxWidth}
        onClick={(_) => {
          // do nothing
        }}
        interactable={false}
      />
    </HeightTrackingContainer>
  )
}

export default Submission
