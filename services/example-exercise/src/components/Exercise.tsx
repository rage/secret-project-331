import { useState } from "react"

import HeightTrackingContainer from "../shared-module/components/HeightTrackingContainer"
import { PublicAlternative } from "../util/stateInterfaces"

import ExerciseBase from "./ExerciseBase"

interface Props {
  state: PublicAlternative[]
  port: MessagePort
  maxWidth: number | null
}

const Exercise: React.FC<Props> = ({ port, maxWidth, state }) => {
  const [selectedId, _setSelectedId] = useState<string | null>(null)

  const setSelectedId: typeof _setSelectedId = (value) => {
    const res = _setSelectedId(value)
    if (!port) {
      console.error("Cannot send current state to parent because I don't have a port")
      return
    }
    console.log("Posting current state to parent")
    port.postMessage({ message: "current-state", data: { selectedOptionId: value } })
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

export default Exercise
