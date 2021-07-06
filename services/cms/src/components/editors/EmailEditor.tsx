import { BlockInstance } from "@wordpress/blocks"
import LoadingButton from "@material-ui/lab/LoadingButton"
import SaveIcon from "@material-ui/icons/Save"
import dynamic from "next/dynamic"
import React, { useState } from "react"
import { allowedEmailCoreBlocks } from "../../blocks/supportedGutenbergBlocks"
import { EmailTemplate, EmailTemplateUpdate } from "../../services/services.types"
import UpdateEmailDetailsForm from "../forms/UpdateEmailDetailsForm"

interface EmailEditorProps {
  data: EmailTemplate
  handleSave: (template: EmailTemplateUpdate) => Promise<EmailTemplate>
}

const EditorLoading = <div>Loading e-mail editor...</div>

const EmailGutenbergEditor = dynamic(() => import("./GutenbergEditor"), {
  ssr: false,
  loading: () => EditorLoading,
})

const EmailEditor: React.FC<EmailEditorProps> = ({ data, handleSave }) => {
  const [content, setContent] = useState<BlockInstance[]>(data.content)
  const [name, setName] = useState(data.name)
  const [subject, setSubject] = useState(data.subject)

  const [saving, setSaving] = useState(false)

  const handleOnSave = async () => {
    setSaving(true)
    const res = await handleSave({ subject, name, content })
    setContent(res.content)
    setName(res.name)
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
