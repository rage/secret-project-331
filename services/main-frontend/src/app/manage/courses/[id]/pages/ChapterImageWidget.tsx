"use client"

import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import UploadImageForm from "@/components/forms/UploadImageForm"
import { deleteChapterImage, updateChapterImage } from "@/generated/api/sdk.generated"
import type { Chapter } from "@/generated/api/types.generated"
import Button from "@/shared-module/common/components/Button"
import { useDialog } from "@/shared-module/common/components/dialogs/DialogProvider"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { validateFile } from "@/shared-module/common/utils/files"

export interface ChapterImageControlsProps {
  chapter: Chapter
  onChapterUpdated?: () => void
}

const ACCEPTED_IMAGE_FILE_TYPES = ["image"]

const ChapterImageWidget: React.FC<React.PropsWithChildren<ChapterImageControlsProps>> = ({
  chapter,
  onChapterUpdated,
}) => {
  const { t } = useTranslation()
  const { confirm } = useDialog()
  const [chapterImageUrl, setChapterImageUrl] = useState(chapter.chapter_image_url)

  const uploadImageMutation = useToastMutation(
    async (imageFile: File) => {
      validateFile(imageFile, ACCEPTED_IMAGE_FILE_TYPES)

      return updateChapterImage({
        path: {
          chapter_id: chapter.id,
        },
        body: {
          file: imageFile as unknown as number[],
        },
        throwOnError: true,
      })
    },
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
        setChapterImageUrl(res.chapter_image_url ?? null)
      },
    },
  )

  const removeImageMutation = useToastMutation(
    () =>
      deleteChapterImage({
        path: {
          chapter_id: chapter.id,
        },
        throwOnError: true,
      }),
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
