import { BlockInstance } from "@wordpress/blocks"
import LoadingButton from "@material-ui/lab/LoadingButton"
import SaveIcon from "@material-ui/icons/Save"
import dynamic from "next/dynamic"
import React, { useState } from "react"
import { allowedEmailCoreBlocks } from "../../blocks/supportedGutenbergBlocks"
import { EmailTemplate } from "../../services/services.types"

interface EmailEditorProps {
  data: EmailTemplate
  handleSave: (
    emailTemplateId: string,
    subject: string,
    content: BlockInstance[],
  ) => Promise<EmailTemplate>
}

const EditorLoading = <div>Loading e-mail editor...</div>

const EmailGutenbergEditor = dynamic(() => import("./GutenbergEditor"), {
  ssr: false,
  loading: () => EditorLoading,
})

const EmailEditor: React.FC<EmailEditorProps> = ({ data, handleSave }) => {
  const [content, setContent] = useState<BlockInstance[]>(data.content)
  const [subject, setSubject] = useState(data.subject)

  const [saving, setSaving] = useState(false)

  const handleOnSave = async () => {
    setSaving(true)
    const res = await handleSave(data.id, subject, content)
    setContent(res.content)
    setSubject(res.subject)
    setSaving(false)
  }

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

      <EmailGutenbergEditor
        content={content}
        onContentChange={setContent}
        allowedBlocks={allowedEmailCoreBlocks}
      />
    </>
  )
}
export default EmailEditor
