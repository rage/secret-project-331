"use client"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import UploadImageForm from "@/components/forms/UploadImageForm"
import { removeChapterImage, setChapterImage } from "@/services/backend/chapters"
import { Chapter } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import { useDialog } from "@/shared-module/common/components/dialogs/DialogProvider"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"

export interface ChapterImageControlsProps {
  chapter: Chapter
  onChapterUpdated?: () => void
}

const ChapterImageWidget: React.FC<React.PropsWithChildren<ChapterImageControlsProps>> = ({
  chapter,
  onChapterUpdated,
}) => {
  const { t } = useTranslation()
  const { confirm } = useDialog()
  const [chapterImageUrl, setChapterImageUrl] = useState(chapter.chapter_image_url)

  const uploadImageMutation = useToastMutation(
    (imageFile: File) => setChapterImage(chapter.id, imageFile),
    {
      notify: true,
      method: "POST",
      successMessage: t("message-saved-successfully"),
      errorMessage: t("message-saving-failed"),
    },
    {
      onSuccess: (res) => {
        if (onChapterUpdated) {
          onChapterUpdated()
        }
        setChapterImageUrl(res.chapter_image_url)
      },
    },
  )

  const removeImageMutation = useToastMutation(
    () => removeChapterImage(chapter.id),
    {
      notify: true,
      method: "DELETE",
      successMessage: t("message-deleting-succesful"),
      errorMessage: t("message-deleting-failed"),
    },
    {
      onSuccess: () => {
        if (onChapterUpdated) {
          onChapterUpdated()
        }
        setChapterImageUrl(null)
      },
    },
  )

  const handleRemoveImage = async () => {
    const confirmed = await confirm(
      t("confirm-remove-chapter-image"),
      t("confirm-remove-chapter-image-title"),
    )
    if (confirmed) {
      removeImageMutation.mutate()
    }
  }

  return (
    <div>
      {chapterImageUrl ? (
        <>
          <img src={chapterImageUrl} alt={t("image-alt-what-to-display-on-chapter")} />
          <Button
            size="medium"
            variant="secondary"
            onClick={handleRemoveImage}
            disabled={removeImageMutation.isPending}
          >
            {t("button-text-remove")}
          </Button>
        </>
      ) : (
        <div>{t("no-chapter-image")}</div>
      )}
      <UploadImageForm mutation={uploadImageMutation} hasExistingImage={!!chapterImageUrl} />
    </div>
  )
}

export default ChapterImageWidget
