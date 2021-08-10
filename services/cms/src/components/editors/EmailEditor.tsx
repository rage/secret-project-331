import SaveIcon from "@material-ui/icons/Save"
import LoadingButton from "@material-ui/lab/LoadingButton"
import { BlockInstance } from "@wordpress/blocks"
import dynamic from "next/dynamic"
import React, { useState } from "react"

import { allowedEmailCoreBlocks } from "../../blocks/supportedGutenbergBlocks"
import { EmailTemplate, EmailTemplateUpdate } from "../../shared-module/bindings"
import { normalWidthCenteredComponentStyles } from "../../shared-module/styles/componentStyles"
import { modifyBlocks } from "../../utils/Gutenberg/modifyBlocks"
import { removeUnsupportedBlockType } from "../../utils/Gutenberg/removeUnsupportedBlockType"
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
  const [content, setContent] = useState<BlockInstance[]>(
    modifyBlocks(data.content as BlockInstance[], allowedEmailCoreBlocks) as BlockInstance[],
  )
  const [name, setName] = useState(data.name)
  const [subject, setSubject] = useState(data.subject ?? "")
  const [saving, setSaving] = useState(false)

  const handleOnSave = async () => {
    setSaving(true)
    const res = await handleSave({
      subject,
      name,
      content: removeUnsupportedBlockType(content),
      exercise_completions_threshold: null,
      points_threshold: null,
    })
    setContent(res.content as BlockInstance[])
    setName(res.name)
    setSubject(res.subject ?? "")
    setSaving(false)
  }

  return (
    <>
      <div className="editor__component">
        <div className={normalWidthCenteredComponentStyles}>
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
        </div>
      </div>

      <EmailGutenbergEditor
        content={content}
        onContentChange={setContent}
        allowedBlocks={allowedEmailCoreBlocks}
      />
    </>
  )
}
export default EmailEditor
