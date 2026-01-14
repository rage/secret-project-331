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

import { useUserChapterLocks } from "@/hooks/course-material/useUserChapterLocks"
import { getChapterLockPreview, lockChapter } from "@/services/course-material/backend"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { useDialog } from "@/shared-module/common/components/dialogs/DialogProvider"
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

      let message = t("lock-chapter-confirm-message")
      if (preview.has_unreturned_exercises) {
        const exerciseNames = preview.unreturned_exercises.map((e) => e.name).join(", ")
        // eslint-disable-next-line i18next/no-literal-string
        message = `${t("lock-chapter-confirm-message")}\n\n${t("lock-chapter-unreturned-warning", {
          count: preview.unreturned_exercises_count,
          exercises: exerciseNames,
        })}`
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
