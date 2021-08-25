import React, { useState } from "react"

import { removeChapterImage, setChapterImage } from "../services/backend/chapters"
import { Chapter } from "../shared-module/bindings"
import Button from "../shared-module/components/Button"

import UploadImageForm from "./forms/UploadImageForm"

export interface ChapterImageControlsProps {
  chapter: Chapter
  onChapterUpdated: () => void
}

const ChapterImageWidget: React.FC<ChapterImageControlsProps> = ({ chapter, onChapterUpdated }) => {
  const [allowRemove, setAllowRemove] = useState(true)
  const [error, setError] = useState<unknown>()

  const handleSubmit = async (imageFile: File) => {
    try {
      await setChapterImage(chapter.id, imageFile)
      onChapterUpdated()
      setError(undefined)
    } catch (e) {
      setError(e)
    }
  }

  const handleRemove = async () => {
    setAllowRemove(false)
    try {
      await removeChapterImage(chapter.id)
      onChapterUpdated()
      setError(undefined)
    } catch (e) {
      setError(e)
    } finally {
      setAllowRemove(true)
    }
  }

  return (
    <div>
      {error && <pre>{JSON.stringify(`${error}`, undefined, 2)}</pre>}
      {chapter.chapter_image_url ? (
        <>
          <img src={chapter.chapter_image_url} alt="What to display on the chapter." />
          <Button size="medium" variant="secondary" onClick={handleRemove} disabled={!allowRemove}>
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
