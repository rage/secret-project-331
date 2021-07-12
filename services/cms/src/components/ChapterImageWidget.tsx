import React from "react"

import { updateChapter } from "../services/backend/chapters"
import { uploadFileFromPage } from "../services/backend/media"
import { Chapter } from "../services/services.types"

import UploadImageForm from "./forms/UploadImageForm"

export interface ChapterImageControlsProps {
  chapter: Chapter
  onChapterUpdated: () => void
}

const ChapterImageWidget: React.FC<ChapterImageControlsProps> = ({ chapter, onChapterUpdated }) => {
  const handleSubmit = async (imageFile: File) => {
    const imageUrl = (await uploadFileFromPage(imageFile, chapter.course_id)).url
    await updateChapter(chapter.id, {
      chapter_image_url: imageUrl,
      chapter_number: chapter.chapter_number,
      front_page_id: chapter.front_page_id,
      name: chapter.name,
    })
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
