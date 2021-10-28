import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { removeChapterImage, setChapterImage } from "../services/backend/chapters"
import { Chapter } from "../shared-module/bindings"
import Button from "../shared-module/components/Button"

import UploadImageForm from "./forms/UploadImageForm"

export interface ChapterImageControlsProps {
  chapter: Chapter
  onChapterUpdated: () => void
}

const ChapterImageWidget: React.FC<ChapterImageControlsProps> = ({ chapter, onChapterUpdated }) => {
  const { t } = useTranslation()
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
          <img src={chapter.chapter_image_url} alt={t("image-alt-what-to-display-on-chapter")} />
          <Button size="medium" variant="secondary" onClick={handleRemove} disabled={!allowRemove}>
            {t("button-text-remove")}
          </Button>
        </>
      ) : (
        <div>{t("no-chapter-image")}</div>
      )}
      <UploadImageForm onSubmit={handleSubmit} />
    </div>
  )
}

export default ChapterImageWidget
