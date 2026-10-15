import { useState } from "react"

import type { CurrentStateMessage } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types"
import { toVersionedAnswer, type Answer, type PublicAlternative } from "@/util/stateInterfaces"

import ExerciseBase from "./ExerciseBase"

interface Props {
  state: PublicAlternative[]
  port: MessagePort
  /** Prior answer replayed by the host on retry; used to prefill the selection. */
  previousSubmission: Answer | null
}

const Exercise: React.FC<React.PropsWithChildren<Props>> = ({
  port,
  state,
  previousSubmission,
}) => {
  // Lazy initializer: seed the selection from the previous submission exactly once (on mount). We do
  // NOT post `current-state` here — only real user clicks emit — so restoring a prior answer can't
  // trigger a render/emit loop.
  const [selectedId, setSelectedId] = useState<string | null>(
    () => previousSubmission?.selectedOptionId ?? null,
  )

  const handleSelect = (optionId: string) => {
    setSelectedId(optionId)

    if (!port) {
      console.error("Cannot send current state to parent because I don't have a port")
      return
    }

    // Report the current answer to the parent so it can be saved (as the versioned stored shape).
    const message: CurrentStateMessage = {
      // oxlint-disable-next-line i18next/no-literal-string
      message: "current-state",
      data: toVersionedAnswer(optionId),
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
