import React, { useState } from "react"

import HeightTrackingContainer from "../shared-module/components/HeightTrackingContainer"
import { CurrentStateMessage } from "../shared-module/iframe-protocol-types"
import { PublicAlternative } from "../util/stateInterfaces"

import ExerciseBase from "./ExerciseBase"

export interface PlaygroundExerciseProps {
  port: MessagePort
  maxWidth: number | null
  state: PublicAlternative[]
}

const PlaygroundExercise: React.FC<PlaygroundExerciseProps> = ({ port, maxWidth, state }) => {
  const [selectedId, _setSelectedId] = useState<string | null>(null)

  const setSelectedId: typeof _setSelectedId = (value) => {
    const res = _setSelectedId(value)
    if (!port) {
      // eslint-disable-next-line i18next/no-literal-string
      console.error("Cannot send current state to parent because I don't have a port")
      return
    }
    // eslint-disable-next-line i18next/no-literal-string
    console.info("Posting current state to parent")
    const message: CurrentStateMessage = {
      // eslint-disable-next-line i18next/no-literal-string
      message: "current-state",
      data: { selectedOptionId: value },
      valid: true,
    }
    port.postMessage(message)
    return res
  }
  return (
    <HeightTrackingContainer port={port}>
      <ExerciseBase
        alternatives={state}
        selectedId={selectedId}
        maxWidth={maxWidth}
        onClick={(selectedId) => {
          setSelectedId(selectedId)
        }}
        interactable={true}
        model_solutions={null}
      />
    </HeightTrackingContainer>
  )
}

export default PlaygroundExercise
