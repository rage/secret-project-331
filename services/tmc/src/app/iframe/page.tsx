"use client"

/* eslint-disable i18next/no-literal-string */
import { css } from "@emotion/css"
import { useSearchParams } from "next/navigation"
import React from "react"

import StateRenderer from "@/components/StateRenderer"
import { useIframeProtocol } from "@/hooks/useIframeProtocol"
import HeightTrackingContainer from "@/shared-module/common/components/HeightTrackingContainer"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import withSuspenseBoundary from "@/shared-module/common/utils/withSuspenseBoundary"

const Iframe: React.FC = () => {
  const searchParams = useSearchParams()
  const rawMaxWidth = searchParams?.get("width")
  let maxWidth: number | null = 500
  if (rawMaxWidth) {
    maxWidth = Number(rawMaxWidth)
  }

  const {
    port,
    state,
    testRequestResponse,
    fileUploadResponse,
    setStateAndSend,
    sendFileUploadMessage,
    requestRepositoryExercises,
  } = useIframeProtocol()

  const contentMaxWidth =
    state?.view_type === "answer-exercise" ? undefined : (maxWidth ?? undefined)
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

export default withErrorBoundary(withSuspenseBoundary(Iframe))
