import { css } from "@emotion/css"
import { BlockInstance } from "@wordpress/blocks"
import dynamic from "next/dynamic"
import React, { useEffect } from "react"

import { MediaUploadProps } from "../../services/backend/media/mediaUpload"
import Spinner from "../../shared-module/components/Spinner"

interface PeerReviewAdditionalInstructionsEditorProps {
  content: BlockInstance[]
  setContent: (value: BlockInstance[]) => void
}

const EditorLoading = <Spinner variant="medium" />

const GutenbergEditor = dynamic(() => import("./GutenbergEditor"), {
  ssr: false,
  loading: () => EditorLoading,
})

const PeerReviewAdditionalInstructionsEditor = (
  props: PeerReviewAdditionalInstructionsEditorProps,
) => {
  const additionalInstructionsWrapperRef = React.useRef<HTMLDivElement>(null)
  const [additionalInstructionsFocused, setAdditionalInstructionsFocused] = React.useState(false)

  // Detect focus change
  useEffect(() => {
    const handleFocusChange = (e: FocusEvent) => {
      if (additionalInstructionsWrapperRef.current?.contains(e.target as Node)) {
        setAdditionalInstructionsFocused(true)
      } else {
        setAdditionalInstructionsFocused(false)
      }
    }

    document.addEventListener("focusin", handleFocusChange)
    document.addEventListener("focusout", handleFocusChange)
    return () => {
      document.removeEventListener("focusin", handleFocusChange)
      document.removeEventListener("focusout", handleFocusChange)
    }
  }, [])

  return (
    <div
      className={css`
        border: 1px solid #e2e8f0;
        padding: 0 0.5rem;
        margin-bottom: 1rem;
        margin-top: 0.5rem;
      `}
      ref={additionalInstructionsWrapperRef}
    >
      <GutenbergEditor
        showSidebar={additionalInstructionsFocused}
        content={props.content}
        onContentChange={props.setContent}
        mediaUpload={function (props: MediaUploadProps): void {
          // TODO
        }}
        needToRunMigrationsAndValidations={false}
        setNeedToRunMigrationsAndValidations={function (value: boolean): void {
          // TODO
        }}
      />
    </div>
  )
}
export default PeerReviewAdditionalInstructionsEditor
