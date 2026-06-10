"use client"

import { useState } from "react"

import ExerciseBase from "./ExerciseBase"

import { CurrentStateMessage } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types"
import { Answer, PublicAlternative } from "@/util/stateInterfaces"

interface Props {
  state: PublicAlternative[]
  port: MessagePort
}

const Exercise: React.FC<React.PropsWithChildren<Props>> = ({ port, state }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const handleSelect = (optionId: string) => {
    setSelectedId(optionId)

    if (!port) {
      console.error("Cannot send current state to parent because I don't have a port")
      return
    }

    // Report the current answer to the parent so it can be saved.
    const data: Answer = { selectedOptionId: optionId }
    const message: CurrentStateMessage = {
      // eslint-disable-next-line i18next/no-literal-string
      message: "current-state",
      data,
      valid: true,
    }
    port.postMessage(message)
  }

  return (
    <ExerciseBase
      alternatives={state}
      selectedId={selectedId}
      onClick={handleSelect}
      interactable={true}
      model_solutions={null}
    />
  )
}

export default Exercise
