import { BlockInstance } from "@wordpress/blocks"
import LoadingButton from "@material-ui/lab/LoadingButton"
import SaveIcon from "@material-ui/icons/Save"
import dynamic from "next/dynamic"
import React, { useState } from "react"

interface EmailEditorProps {
  data: any
  handleSave: (email: any) => Promise<any>
}

const EditorLoading = <div>Loading e-mail editor...</div>

const EmailGutenbergEditor = dynamic(() => import("./EmailGutenbergEditor"), {
  ssr: false,
  loading: () => EditorLoading,
})

const EmailEditor: React.FC<EmailEditorProps> = ({ data, handleSave }) => {
  const [content, setContent] = useState<BlockInstance[]>(data.content)
  const [saving, setSaving] = useState(false)

  const handleOnSave = async () => {
    // setSaving(true)
    // const res = await handleSave({
    //   content,
    // })
    // setContent(res.content)
    // setSaving(false)
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

      <EmailGutenbergEditor content={content} onContentChange={setContent} />
    </>
  )
}
export default EmailEditor
