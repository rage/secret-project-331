import { Button } from "@material-ui/core"
import { BlockInstance } from "@wordpress/blocks"
import dynamic from "next/dynamic"
import React, { useState } from "react"
import { Page, PageUpdate } from "../services/services.types"
import UpdatePageDetailsForm from "./forms/UpdatePageDetailsForm"

interface PageEditorProps {
  data: Page
  handleSave: (page: PageUpdate) => void
}

const EditorLoading = <div>Loading editor...</div>

const Editor = dynamic(() => import("./Editor"), {
  ssr: false,
  loading: () => EditorLoading,
})

const PageEditor: React.FC<PageEditorProps> = ({ data, handleSave }) => {
  const [title, setTitle] = useState(data.title)
  const [urlPath, setUrlPath] = useState(data.url_path)
  const [content, setContent] = useState<BlockInstance[]>(data.content)
  const [showCourseEdit, setShowCourseEdit] = useState(false)

  const handleOnSave = () => {
    handleSave({ title, url_path: urlPath, content })
  }
  const handleOnUpdateCourseData = (newTitle: string, newPath: string) => {
    setTitle(newTitle)
    setUrlPath(newPath)
    setShowCourseEdit(!showCourseEdit)
    handleOnSave()
  }

  const onEditCourseDetails = () => {
    setShowCourseEdit(!showCourseEdit)
  }

  return (
    <>
      <h1>{data.title}</h1>
      <Button onClick={handleOnSave}>Save</Button>
      {showCourseEdit ? (
        <>
          <Button onClick={onEditCourseDetails}>Hide</Button>
          <UpdatePageDetailsForm
            title={title}
            urlPath={urlPath}
            onUpdateCourseData={handleOnUpdateCourseData}
          />
        </>
      ) : (
        <Button onClick={onEditCourseDetails}>Edit Course Details</Button>
      )}
      <Editor content={content} onContentChange={setContent} />
    </>
  )
}
export default PageEditor
