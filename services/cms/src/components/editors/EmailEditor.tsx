import SaveIcon from "@material-ui/icons/Save"
import LoadingButton from "@material-ui/lab/LoadingButton"
import { BlockInstance } from "@wordpress/blocks"
import dynamic from "next/dynamic"
import React, { useMemo, useState } from "react"

import { blockTypeMapForPages, blockTypeMapForTopLevelPages } from "../../blocks"
import { allowedEmailCoreBlocks } from "../../blocks/supportedGutenbergBlocks"
import { EmailTemplate, EmailTemplateUpdate } from "../../shared-module/bindings"
import UpdateEmailDetailsForm from "../forms/UpdateEmailDetailsForm"
interface EmailEditorProps {
  data: EmailTemplate
  handleSave: (updatedTemplate: EmailTemplateUpdate) => Promise<EmailTemplate>
}

const EditorLoading = <div>Loading e-mail editor...</div>

const EmailGutenbergEditor = dynamic(() => import("./GutenbergEditor"), {
  ssr: false,
  loading: () => EditorLoading,
})

const EmailEditor: React.FC<EmailEditorProps> = ({ data, handleSave }) => {
  const [content, setContent] = useState<BlockInstance[]>(data.content as BlockInstance[])
  const [name, setName] = useState(data.name)
  const [subject, setSubject] = useState(data.subject ?? "")
  const [saving, setSaving] = useState(false)

  const supportedBlocksForPages: string[] = blockTypeMapForPages.map((mapping) => mapping[0])
  const supportedBlocksTopLevelPages: string[] = blockTypeMapForTopLevelPages.map(
    (mapping) => mapping[0],
  )

  const handleOnSave = async () => {
    setSaving(true)
    const modifiedContent: BlockInstance[] = content.map((block) => {
      if (block.name === "moocfi/unsupported-block-type") {
        return block.attributes.originalBlockJson
      } else {
        return block
      }
    })
    const res = await handleSave({
      subject,
      name,
      content: modifiedContent,
      exercise_completions_threshold: null,
      points_threshold: null,
    })
    setContent(res.content as BlockInstance[])
    setName(res.name)
    setSubject(res.subject ?? "")
    setSaving(false)
  }

  /*-----
  const allSupportedBlocks = data.chapter_id
    ? allowedEmailCoreBlocks.concat(supportedBlocksForPages)
    : allowedEmailCoreBlocks.concat(supportedBlocksTopLevelPages)
  -----*/

  const allSupportedBlocks = allowedEmailCoreBlocks.concat(
    supportedBlocksForPages,
    supportedBlocksTopLevelPages,
  )

  useMemo(() => {
    const initialContent = data.content as BlockInstance[]
    const modifiedContent = initialContent.map((block) => {
      if (
        allSupportedBlocks.find((supportedBlock) => supportedBlock === block.name) === undefined
      ) {
        return {
          clientId: block.clientId,
          name: "moocfi/unsupported-block-type",
          isValid: true,
          attributes: { ...block.attributes, originalBlockJson: block },
          innerBlocks: [],
        }
      } else {
        return block
      }
    })
    setContent(modifiedContent)
  }, [data.content])

  return (
    <>
      <LoadingButton
        loadingPosition="start"
        startIcon={<SaveIcon />}
        loading={saving}
        onClick={handleOnSave}
      >
        Save
      </LoadingButton>

      <UpdateEmailDetailsForm
        name={name}
        subject={subject}
        setName={setName}
        setSubject={setSubject}
      />

      <EmailGutenbergEditor
        content={content}
        onContentChange={setContent}
        allowedBlocks={allowedEmailCoreBlocks}
      />
    </>
  )
}
export default EmailEditor
