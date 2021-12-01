import { useEffect } from "react"

import { CurrentStateMessage } from "../shared-module/iframe-protocol-types"
import { StoreState } from "../store/store"
import { denormalizeData } from "../util/normalizerFunctions"

const CURRENT_STATE = "current-state"

export const useSendEditorStateOnChange = (port: MessagePort, state: StoreState): void => {
  useEffect(() => {
    if (!port) {
      return
    }

    const message: CurrentStateMessage = {
      message: CURRENT_STATE,
      data: { private_spec: denormalizeData(state) },
      valid: true,
    }
    // eslint-disable-next-line i18next/no-literal-string
    console.info("Sending current data", JSON.stringify(message))
    port.postMessage(message)
  }, [state, port])
}
