import React from "react"

import { postChapterImage } from "../services/backend/chapters"
import { Chapter } from "../services/services.types"

import UploadImageForm from "./forms/UploadImageForm"

export interface ChapterImageControlsProps {
  chapter: Chapter
  onChapterUpdated: () => void
}

const ChapterImageWidget: React.FC<ChapterImageControlsProps> = ({ chapter, onChapterUpdated }) => {
  const handleSubmit = async (imageFile: File) => {
    await postChapterImage(chapter.id, imageFile)
    onChapterUpdated()
  }

  return (
    <div>
      {chapter.chapter_image_url ? (
        <img src={chapter.chapter_image_url} />
      ) : (
        <div>No chapter image.</div>
      )}
      <UploadImageForm onSubmit={handleSubmit} />
    </div>
  )
}

export default ChapterImageWidget
