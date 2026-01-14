"use client"
import { css } from "@emotion/css"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import React, { useState } from "react"

import { BlockRendererProps } from "../.."

import LockAnimation from "./LockAnimation"
import LockChapterLoadingView from "./LockChapterLoadingView"
import LockChapterLockedView from "./LockChapterLockedView"
import LockChapterUnlockedView from "./LockChapterUnlockedView"

import { useUserChapterLocks } from "@/hooks/course-material/useUserChapterLocks"
import { lockChapter } from "@/services/course-material/backend"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { courseMaterialAtom } from "@/state/course-material"
import { invalidateUserChapterLocks, reloadCurrentPageData } from "@/state/course-material/queries"

interface LockChapterProps {
  chapterId: string
  blockProps: BlockRendererProps<unknown>
}

type LockState = "idle" | "locking" | "locked"

const LockChapter: React.FC<LockChapterProps> = ({ chapterId, blockProps }) => {
  const courseMaterialState = useAtomValue(courseMaterialAtom)
  const queryClient = useQueryClient()
  // eslint-disable-next-line i18next/no-literal-string
  const [lockState, setLockState] = useState<LockState>("idle")
  const [showAnimation, setShowAnimation] = useState(false)

  const courseId =
    courseMaterialState.status === "ready" ? (courseMaterialState.course?.id ?? null) : null
  const getUserLocks = useUserChapterLocks(courseId)

  const lockMutation = useMutation({
    mutationFn: () => lockChapter(chapterId),
    onSuccess: async () => {
      // eslint-disable-next-line i18next/no-literal-string
      setLockState("locking")
      setShowAnimation(true)
      await invalidateUserChapterLocks(queryClient, courseId)
    },
  })

  const handleAnimationComplete = async () => {
    // eslint-disable-next-line i18next/no-literal-string
    setLockState("locked")
    await reloadCurrentPageData(queryClient)
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
          onLock={() => lockMutation.mutate()}
          isLocking={lockMutation.isPending}
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
