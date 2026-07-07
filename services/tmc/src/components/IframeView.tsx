import { css } from "@emotion/css"
import React from "react"

import StateRenderer from "@/components/StateRenderer"
import { useIframeProtocol } from "@/hooks/useIframeProtocol"
import HeightTrackingContainer from "@/shared-module/exercise-react/react/components/HeightTrackingContainer"

export interface IframeViewProps {
  /** Max content width in px for the editor / submission views; the answer view is unconstrained. */
  maxWidth: number
}

const IframeView: React.FC<IframeViewProps> = ({ maxWidth }) => {
  const {
    port,
    state,
    testRequestResponse,
    fileUploadResponse,
    setStateAndSend,
    sendFileUploadMessage,
    requestRepositoryExercises,
  } = useIframeProtocol()

  const contentMaxWidth = state?.view_type === "answer-exercise" ? undefined : maxWidth
  return (
    <HeightTrackingContainer port={port}>
      <div
        className={css`
          width: 100%;
          ${contentMaxWidth != null ? `max-width: ${contentMaxWidth}px;` : ""}
          margin: 0 auto;
        `}
      >
        <StateRenderer
          setState={setStateAndSend}
          state={state}
          testRequestResponse={testRequestResponse}
          sendFileUploadMessage={sendFileUploadMessage}
          fileUploadResponse={fileUploadResponse}
          requestRepositoryExercises={requestRepositoryExercises}
        />
      </div>
    </HeightTrackingContainer>
  )
}

export default IframeView
