import { css } from "@emotion/css"
import { BlockInstance } from "@wordpress/blocks"
import dynamic from "next/dynamic"
import React, { useEffect, useState } from "react"

import mediaUploadBuilder from "../../services/backend/media/mediaUpload"

import Spinner from "@/shared-module/common/components/Spinner"

interface PeerReviewAdditionalInstructionsEditorProps {
  content: BlockInstance[]
  setContent: (value: BlockInstance[]) => void
  courseId: string
}

const EditorLoading = <Spinner variant="medium" />

const GutenbergEditor = dynamic(() => import("./GutenbergEditor"), {
  ssr: false,
  loading: () => EditorLoading,
})

const PeerReviewAdditionalInstructionsEditor = (
  props: PeerReviewAdditionalInstructionsEditorProps,
) => {
  // Defaults to true so that the migrations get run once. This is fine here because when this component is rendered, the content is already available.
  const [needToRunMigrationsAndValidations, setNeedToRunMigrationsAndValidations] = useState(true)
  const additionalInstructionsWrapperRef = React.useRef<HTMLDivElement>(null)
  const [additionalInstructionsFocused, setAdditionalInstructionsFocused] = React.useState(false)

  // Detect focus change
  useEffect(() => {
    const handleFocusChange = (e: FocusEvent) => {
      const target = e.target as Node

      if (
        additionalInstructionsWrapperRef.current?.contains(e.target as Node) ||
        // Focus detection does not always work with the contains in the gutenberg editor, so we will try to detect that case separately
        Array.from(target.parentElement?.classList ?? []).find(
          (c) => c.indexOf("block-editor") > -1,
        )
      ) {
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
        mediaUpload={mediaUploadBuilder({ courseId: props.courseId })}
        needToRunMigrationsAndValidations={needToRunMigrationsAndValidations}
        setNeedToRunMigrationsAndValidations={setNeedToRunMigrationsAndValidations}
      />
    </div>
  )
}
export default PeerReviewAdditionalInstructionsEditor
