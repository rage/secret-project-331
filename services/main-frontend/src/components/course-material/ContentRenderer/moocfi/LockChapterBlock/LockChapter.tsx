"use client"
import { css } from "@emotion/css"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Padlock } from "@vectopus/atlas-icons-react"
import { useAtomValue } from "jotai"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { BlockRendererProps } from "../.."
import InnerBlocks from "../../util/InnerBlocks"

import LockAnimation from "./LockAnimation"

import { useUserChapterLocks } from "@/hooks/course-material/useUserChapterLocks"
import { lockChapter } from "@/services/course-material/backend"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { baseTheme, primaryFont } from "@/shared-module/common/styles"
import { courseMaterialAtom } from "@/state/course-material"
import { invalidateUserChapterLocks, reloadCurrentPageData } from "@/state/course-material/queries"

interface LockChapterProps {
  chapterId: string
  blockProps: BlockRendererProps<unknown>
}

type LockState = "idle" | "locking" | "locked"

const skeletonPulse = css`
  @keyframes pulse {
    0%,
    100% {
      background-color: ${baseTheme.colors.gray[200]};
    }
    50% {
      background-color: ${baseTheme.colors.gray[300]};
    }
  }

  animation: pulse 1.5s ease-in-out infinite;
`

const LockChapterUnlockedView: React.FC<{
  onLock: () => void
  isLocking: boolean
  error: Error | null
}> = ({ onLock, isLocking, error }) => {
  const { t } = useTranslation()

  return (
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
          color: ${baseTheme.colors.blue[600]};
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
          {t("lock-chapter-description")}
        </p>
      </div>
      <div
        className={css`
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          width: 100%;
          max-width: 300px;
        `}
      >
        <Button
          variant="primary"
          size="large"
          onClick={onLock}
          disabled={isLocking}
          className={css`
            width: 100%;
          `}
        >
          {isLocking ? t("locking-chapter") : t("lock-chapter")}
        </Button>
        {error && <ErrorBanner variant={"readOnly"} error={error} />}
      </div>
    </div>
  )
}

const LockChapterLoadingView: React.FC = () => {
  return (
    <div
      className={css`
        background: ${baseTheme.colors.clear[100]};
        border: 1px solid ${baseTheme.colors.gray[300]};
        border-radius: 8px;
        padding: 2.5rem 2rem;
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
      `}
    >
      <div
        className={css`
          display: flex;
          align-items: center;
          gap: 1rem;
        `}
      >
        <div
          className={css`
            width: 32px;
            height: 32px;
            border-radius: 4px;
            ${skeletonPulse}
          `}
        />
        <div
          className={css`
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
          `}
        >
          <div
            className={css`
              height: 20px;
              border-radius: 4px;
              width: 60%;
              ${skeletonPulse}
            `}
          />
          <div
            className={css`
              height: 16px;
              border-radius: 4px;
              width: 80%;
              ${skeletonPulse}
            `}
          />
        </div>
      </div>
      <div
        className={css`
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        `}
      >
        <div
          className={css`
            height: 16px;
            border-radius: 4px;
            ${skeletonPulse}
          `}
        />
        <div
          className={css`
            height: 16px;
            border-radius: 4px;
            width: 90%;
            ${skeletonPulse}
          `}
        />
        <div
          className={css`
            height: 16px;
            border-radius: 4px;
            width: 75%;
            ${skeletonPulse}
          `}
        />
      </div>
    </div>
  )
}

const LockChapterLockedView: React.FC<{
  blockProps: BlockRendererProps<unknown>
}> = ({ blockProps }) => {
  const { t } = useTranslation()

  return (
    <div
      className={css`
        background: ${baseTheme.colors.green[50]};
        border: 2px solid ${baseTheme.colors.green[400]};
        border-radius: 8px;
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
      `}
    >
      <div
        className={css`
          display: flex;
          align-items: center;
          gap: 1rem;
        `}
      >
        <div
          className={css`
            color: ${baseTheme.colors.green[600]};
            display: flex;
            align-items: center;
            flex-shrink: 0;
          `}
        >
          <Padlock size={32} />
        </div>
        <div
          className={css`
            flex: 1;
          `}
        >
          <h3
            className={css`
              margin: 0 0 0.25rem 0;
              font-family: ${primaryFont};
              font-size: 1.125rem;
              font-weight: 600;
              color: ${baseTheme.colors.gray[700]};
            `}
          >
            {t("chapter-locked-message")}
          </h3>
          <p
            className={css`
              margin: 0;
              font-family: ${primaryFont};
              font-size: 0.9375rem;
              color: ${baseTheme.colors.gray[600]};
            `}
          >
            {t("chapter-locked-description")}
          </p>
        </div>
      </div>
      {blockProps.data.innerBlocks && blockProps.data.innerBlocks.length > 0 && (
        <div
          className={css`
            padding-top: 1.5rem;
            border-top: 1px solid ${baseTheme.colors.green[300]};
          `}
        >
          <InnerBlocks
            parentBlockProps={blockProps}
            dontAllowInnerBlocksToBeWiderThanParentBlock={false}
          />
        </div>
      )}
    </div>
  )
}

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
