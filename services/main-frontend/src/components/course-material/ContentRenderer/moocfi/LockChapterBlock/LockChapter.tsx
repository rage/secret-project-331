"use client"
import { css } from "@emotion/css"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useAtomValue, useSetAtom } from "jotai"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { BlockRendererProps } from "../.."

import LockAnimation from "./LockAnimation"
import LockChapterLoadingView from "./LockChapterLoadingView"
import LockChapterLockedView from "./LockChapterLockedView"
import LockChapterUnlockedView from "./LockChapterUnlockedView"

import { useQuery } from "@tanstack/react-query"

import { useUserChapterLocks } from "@/hooks/course-material/useUserChapterLocks"
import { getChapterLockPreview, lockChapter } from "@/services/course-material/backend"
import { fetchAllChaptersByCourseId } from "@/services/backend/chapters"
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

  const courseId =
    courseMaterialState.status === "ready" ? (courseMaterialState.course?.id ?? null) : null
  const getUserLocks = useUserChapterLocks(courseId)
  
  const chaptersQuery = useQuery({
    queryKey: ["chapters", courseId],
    queryFn: () => fetchAllChaptersByCourseId(courseId!),
    enabled: !!courseId,
  })

  const chapter = chaptersQuery.data?.find((c) => c.id === chapterId)

  if (!chapter?.exercises_done_through_locking) {
    return null
  }

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

  const handleLock = async () => {
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
      throw error
    }
  }

  const handleAnimationComplete = async () => {
    // eslint-disable-next-line i18next/no-literal-string
    setLockState("locked")
    await triggerRefetch()
    await new Promise((resolve) => setTimeout(resolve, 200))
    setShowAnimation(false)
  }

  const currentChapterIsLocked = getUserLocks.data?.some((lock) => lock.chapter_id === chapterId)

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
      ) : lockState === "locking" ? (
        <LockChapterLoadingView />
      ) : (
        <LockChapterUnlockedView
          onLock={handleLock}
          isLocking={lockMutation.isPending}
          isLoadingPreview={isLoadingPreview}
          error={lockMutation.error as Error | null}
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
