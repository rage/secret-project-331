import { useState } from "react"

import { PublicAlternative } from "../util/stateInterfaces"

import ExerciseBase from "./ExerciseBase"
import HeightTrackingContainer from "./HeightTrackingContainer"

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
    port.postMessage({ message: "current-state-2", data: { selectedValue: value } })
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
      />
    </HeightTrackingContainer>
  )
}

export default Exercise
