"use client"

import { css } from "@emotion/css"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Padlock } from "@vectopus/atlas-icons-react"
import { useAtomValue, useSetAtom } from "jotai"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { BlockRendererProps } from "../.."

import LockAnimation from "./LockAnimation"
import LockChapterLoadingView from "./LockChapterLoadingView"
import LockChapterLockedView from "./LockChapterLockedView"
import LockChapterUnlockedView from "./LockChapterUnlockedView"

import { useUserChapterLocks } from "@/hooks/course-material/useUserChapterLocks"
import { getChapterLockPreview, lockChapter } from "@/services/course-material/backend"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { useDialog } from "@/shared-module/common/components/dialogs/DialogProvider"
import { baseTheme, primaryFont } from "@/shared-module/common/styles"
import { courseMaterialAtom } from "@/state/course-material"
import { userChapterLocksQueryKey } from "@/state/course-material/queries"
import { refetchViewAtom } from "@/state/course-material/selectors"

interface LockChapterProps {
  chapterId: string
  blockProps: BlockRendererProps<unknown>
}

type LockState = "idle" | "locking" | "locked"

const LockChapter: React.FC<LockChapterProps> = ({ chapterId, blockProps }) => {
  const courseMaterialState = useAtomValue(courseMaterialAtom)
  const queryClient = useQueryClient()
  const triggerRefetch = useSetAtom(refetchViewAtom)
  const { confirm } = useDialog()
  const { t } = useTranslation()
  // eslint-disable-next-line i18next/no-literal-string
  const [lockState, setLockState] = useState<LockState>("idle")
  const [showAnimation, setShowAnimation] = useState(false)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [previewError, setPreviewError] = useState<Error | null>(null)

  const courseId =
    courseMaterialState.status === "ready" ? (courseMaterialState.course?.id ?? null) : null
  const getUserLocks = useUserChapterLocks(courseId)

  const course = courseMaterialState.course

  const lockMutation = useMutation({
    mutationFn: () => lockChapter(chapterId),
    onSuccess: async () => {
      // eslint-disable-next-line i18next/no-literal-string
      setLockState("locking")
      setShowAnimation(true)
      await queryClient.refetchQueries({
        queryKey: userChapterLocksQueryKey(courseId),
      })
    },
  })

  if (!course?.chapter_locking_enabled) {
    return null
  }

  const handleLock = async () => {
    setPreviewError(null)
    setIsLoadingPreview(true)
    try {
      const preview = await getChapterLockPreview(chapterId)
      setIsLoadingPreview(false)

      let message: React.ReactNode = (
        <div
          className={css`
            font-family: ${primaryFont};
            line-height: 1.6;
          `}
        >
          <p
            className={css`
              margin: 0 0 1rem 0;
              color: ${baseTheme.colors.gray[700]};
            `}
          >
            {t("lock-chapter-confirm-message")}
          </p>
        </div>
      )

      if (preview.has_unreturned_exercises) {
        message = (
          <div
            className={css`
              font-family: ${primaryFont};
              line-height: 1.6;
            `}
          >
            <p
              className={css`
                margin: 0 0 1.5rem 0;
                color: ${baseTheme.colors.gray[700]};
              `}
            >
              {t("lock-chapter-confirm-message")}
            </p>
            <div
              className={css`
                padding: 1rem;
                background-color: ${baseTheme.colors.yellow[50]};
                border-left: 4px solid ${baseTheme.colors.yellow[500]};
                border-radius: 4px;
                margin-top: 1rem;
              `}
            >
              <p
                className={css`
                  margin: 0 0 0.5rem 0;
                  font-weight: 600;
                  color: ${baseTheme.colors.gray[900]};
                `}
              >
                {t("lock-chapter-unreturned-warning-title")}
              </p>
              <p
                className={css`
                  margin: 0 0 0.75rem 0;
                  color: ${baseTheme.colors.gray[700]};
                `}
              >
                {t("lock-chapter-unreturned-warning-message", {
                  count: preview.unreturned_exercises_count,
                })}
              </p>
              <ul
                className={css`
                  margin: 0;
                  padding-left: 1.5rem;
                  color: ${baseTheme.colors.gray[700]};
                `}
              >
                {preview.unreturned_exercises.map((exercise) => (
                  <li key={exercise.id}>{exercise.name}</li>
                ))}
              </ul>
            </div>
          </div>
        )
      }

      const confirmed = await confirm(message, t("lock-chapter-confirm-title"))
      if (confirmed) {
        lockMutation.mutate()
      }
    } catch (error) {
      setIsLoadingPreview(false)
      setPreviewError(
        error instanceof Error ? error : new Error("Failed to load chapter lock preview"),
      )
    }
  }

  const handleAnimationComplete = async () => {
    // eslint-disable-next-line i18next/no-literal-string
    setLockState("locked")
    await triggerRefetch()
    await new Promise((resolve) => setTimeout(resolve, 200))
    setShowAnimation(false)
  }

  const currentChapterStatus = getUserLocks.data?.find((status) => status.chapter_id === chapterId)
  const currentChapterIsLocked = currentChapterStatus?.status === "completed_and_locked"
  const currentChapterIsNotAccessible =
    !currentChapterStatus || currentChapterStatus.status === "not_unlocked_yet"

  if (getUserLocks.isError) {
    return <ErrorBanner variant={"readOnly"} error={getUserLocks.error} />
  }

  if (getUserLocks.isLoading) {
    return <Spinner variant={"medium"} />
  }

  const shouldShowLockedView = lockState === "locked" || currentChapterIsLocked

  return (
    <div
      className={css`
        margin: 2rem 0;
        position: relative;
      `}
    >
      {shouldShowLockedView ? (
        <LockChapterLockedView blockProps={blockProps} />
      ) : currentChapterIsNotAccessible ? (
        <div
          className={css`
            background: ${baseTheme.colors.clear[100]};
            border: 1px solid ${baseTheme.colors.gray[300]};
            border-radius: 8px;
            padding: 2.5rem 2rem;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 1.5rem;
            text-align: center;
          `}
        >
          <div
            className={css`
              color: ${baseTheme.colors.gray[600]};
              display: flex;
              align-items: center;
              justify-content: center;
            `}
          >
            <Padlock size={48} />
          </div>
          <div
            className={css`
              display: flex;
              flex-direction: column;
              gap: 0.5rem;
              max-width: 500px;
            `}
          >
            <h3
              className={css`
                margin: 0;
                font-family: ${primaryFont};
                font-size: 1.25rem;
                font-weight: 600;
                color: ${baseTheme.colors.gray[700]};
              `}
            >
              {t("lock-chapter-title")}
            </h3>
            <p
              className={css`
                margin: 0;
                font-family: ${primaryFont};
                font-size: 0.9375rem;
                line-height: 1.6;
                color: ${baseTheme.colors.gray[600]};
              `}
            >
              {t("chapter-locked-complete-previous")}
            </p>
          </div>
        </div>
      ) : lockState === "locking" ? (
        <LockChapterLoadingView />
      ) : (
        <LockChapterUnlockedView
          onLock={handleLock}
          isLocking={lockMutation.isPending}
          isLoadingPreview={isLoadingPreview}
          error={lockMutation.error as Error | null}
          previewError={previewError}
        />
      )}

      <div
        className={css`
          position: absolute;
          inset: 0;
          z-index: 10;
          display: ${showAnimation ? "grid" : "none"};
          place-items: center;
          background: rgba(255, 255, 255, 0.9);
          border-radius: 8px;
          pointer-events: ${showAnimation ? "auto" : "none"};
        `}
      >
        <LockAnimation onComplete={handleAnimationComplete} size={200} play={showAnimation} />
      </div>
    </div>
  )
}

export default LockChapter
