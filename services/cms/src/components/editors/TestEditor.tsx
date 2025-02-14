import { css } from "@emotion/css"
import { BlockInstance } from "@wordpress/blocks"
import dynamic from "next/dynamic"
import React, { useReducer, useState } from "react"
import { useTranslation } from "react-i18next"

import { blockTypeMapForPages, blockTypeMapForTopLevelPages } from "../../blocks"
import { allowedBlockVariants, supportedCoreBlocks } from "../../blocks/supportedGutenbergBlocks"
import { EditorContentDispatch, editorContentReducer } from "../../contexts/EditorContentContext"
import { modifyBlocks } from "../../utils/Gutenberg/modifyBlocks"
import SerializeGutenbergModal from "../SerializeGutenbergModal"
import UpdatePageDetailsForm from "../forms/UpdatePageDetailsForm"

import Button from "@/shared-module/common/components/Button"
import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import DebugModal from "@/shared-module/common/components/DebugModal"
import Spinner from "@/shared-module/common/components/Spinner"

const EditorLoading = <Spinner variant="medium" />

const GutenbergEditor = dynamic(() => import("./GutenbergEditor"), {
  ssr: false,
  loading: () => EditorLoading,
})

const supportedBlocks = (): string[] => {
  const supportedBlocksForPages: string[] = blockTypeMapForPages.map((mapping) => mapping[0])

  return supportedCoreBlocks.concat(supportedBlocksForPages)
}

const TestEditor: React.FC = () => {
  const { t } = useTranslation()
  const [title, setTitle] = useState("")
  const savedContent: BlockInstance[] = []
  const [content, contentDispatch] = useReducer(
    editorContentReducer,
    modifyBlocks(savedContent, supportedBlocks()) as BlockInstance[],
  )
  const currentContentStateSaved = false
  const currentlySaving = false

  const saveAndReset = (
    <div>
      <div
        className={css`
          display: flex;
          justify-content: center;
          background: #f5f6f7;
          padding: 1rem;
        `}
      >
        <Button
          variant="primary"
          size="medium"
          className={css`
            margin-right: 1rem;
            border: 1px black solid;
            pointer-events: auto;
          `}
          disabled={currentContentStateSaved || currentlySaving}
        >
          {t("save")}
        </Button>
        <Button
          variant="secondary"
          size="medium"
          className={css`
            margin-left: 1rem;
            border: 1px black solid;
            pointer-events: auto;
          `}
          onClick={() => {
            const res = confirm(t("are-you-sure-you-want-to-discard-changes"))
            if (res) {
              contentDispatch({ type: "setContent", payload: savedContent })
            }
          }}
          disabled={currentContentStateSaved || currentlySaving}
        >
          {t("reset")}
        </Button>
      </div>
    </div>
  )

  return (
    <EditorContentDispatch.Provider value={contentDispatch}>
      <BreakFromCentered sidebar={false}>
        <div className="editor__top-button-wrapper">{saveAndReset}</div>
      </BreakFromCentered>
      <div className="editor__component">
        <div>
          <UpdatePageDetailsForm title={title} setTitle={setTitle} />
        </div>
      </div>
      <div>
        <GutenbergEditor
          content={content}
          onContentChange={(value) => contentDispatch({ type: "setContent", payload: value })}
          customBlocks={blockTypeMapForTopLevelPages}
          allowedBlocks={supportedCoreBlocks}
          allowedBlockVariations={allowedBlockVariants}
          mediaUpload={() => {}}
          inspectorButtons={saveAndReset}
          needToRunMigrationsAndValidations={false}
          setNeedToRunMigrationsAndValidations={() => {}}
        />
      </div>
      <div className="editor__component">
        <div
          className={css`
            margin-top: 1rem;
            margin-bottom: 1rem;
          `}
        >
          <div
            className={css`
              margin-bottom: 0.5rem;
            `}
          >
            <SerializeGutenbergModal content={content} />
          </div>
          <DebugModal
            data={content}
            readOnly={false}
            updateDataOnClose={(data) => contentDispatch({ type: "setContent", payload: data })}
          />
        </div>
      </div>
    </EditorContentDispatch.Provider>
  )
}

export default TestEditor
