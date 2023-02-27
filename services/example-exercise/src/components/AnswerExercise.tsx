import { useState } from "react"

import { CurrentStateMessage } from "../shared-module/exercise-service-protocol-types"
import { Answer, PublicAlternative } from "../util/stateInterfaces"

import ExerciseBase from "./ExerciseBase"

interface Props {
  state: PublicAlternative[]
  port: MessagePort
}

const Exercise: React.FC<React.PropsWithChildren<Props>> = ({ port, state }) => {
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
    // the type should be the same one that is received as the initial selected id
    const data: Answer = { selectedOptionId: value ? value.toString() : "" }
    const message: CurrentStateMessage = {
      // eslint-disable-next-line i18next/no-literal-string
      message: "current-state",
      data: { private_spec: data },
      valid: true,
    }
    port.postMessage(message)
    return res
  }

  return (
    <ExerciseBase
      alternatives={state}
      selectedId={selectedId}
      onClick={(selectedId) => {
        setSelectedId(selectedId)
      }}
      interactable={true}
      model_solutions={null}
    />
  )
}

export default Exercise
