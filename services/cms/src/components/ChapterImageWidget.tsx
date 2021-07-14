import { Button } from "@material-ui/core"
import React, { useState } from "react"

import { postChapterImage, removeChapterImage } from "../services/backend/chapters"
import { Chapter } from "../services/services.types"

import UploadImageForm from "./forms/UploadImageForm"

export interface ChapterImageControlsProps {
  chapter: Chapter
  onChapterUpdated: () => void
}

const ChapterImageWidget: React.FC<ChapterImageControlsProps> = ({ chapter, onChapterUpdated }) => {
  const [error, setError] = useState<unknown>()

  const handleSubmit = async (imageFile: File) => {
    try {
      await postChapterImage(chapter.id, imageFile)
      onChapterUpdated()
    } catch (e) {
      setError(e)
    }
  }

  const handleRemove = async () => {
    try {
      await removeChapterImage(chapter.id)
      onChapterUpdated()
    } catch (e) {
      setError(e)
    }
  }

  return (
    <div>
      {error && <pre>{JSON.stringify(error, undefined, 2)}</pre>}
      {chapter.chapter_image_url ? (
        <>
          <img src={chapter.chapter_image_url} />
          <Button onClick={handleRemove} variant="outlined">
            Remove image
          </Button>
        </>
      ) : (
        <div>No chapter image.</div>
      )}
      <UploadImageForm onSubmit={handleSubmit} />
    </div>
  )
}

export default ChapterImageWidget
