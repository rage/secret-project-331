"use client"
import { css } from "@emotion/css"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Padlock } from "@vectopus/atlas-icons-react"
import { useAtomValue } from "jotai"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { BlockRendererProps } from "../.."
import InnerBlocks from "../../util/InnerBlocks"

import LockAnimation from "./LockAnimation"

import { getUserChapterLocks, lockChapter } from "@/services/course-material/backend"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { baseTheme, primaryFont } from "@/shared-module/common/styles"
import { courseMaterialAtom } from "@/state/course-material"

interface LockChapterProps {
  chapterId: string
  blockProps: BlockRendererProps<unknown>
}

const LockChapter: React.FC<LockChapterProps> = ({ chapterId, blockProps }) => {
  const { t } = useTranslation()
  const courseMaterialState = useAtomValue(courseMaterialAtom)
  const queryClient = useQueryClient()
  const [showAnimation, setShowAnimation] = useState(false)

  const courseId = courseMaterialState.status === "ready" && courseMaterialState.course?.id

  const getUserLocks = useQuery({
    queryKey: [`course-${courseId}-user-chapter-locks`],
    queryFn: () => getUserChapterLocks(courseId as string),
    enabled: !!courseId,
  })

  const lockMutation = useMutation({
    mutationFn: () => lockChapter(chapterId),
    onSuccess: () => {
      // Show the animation after successful lock
      setShowAnimation(true)
    },
  })

  const handleAnimationComplete = async () => {
    // Invalidate queries to show the locked state
    await queryClient.invalidateQueries({
      // eslint-disable-next-line i18next/no-literal-string
      queryKey: [`course-${courseId}-user-chapter-locks`],
    })
    // Wait a bit for the lock to be visible before hiding the overlay
    await new Promise((resolve) => setTimeout(resolve, 500))
    setShowAnimation(false)
  }

  const isLocked = getUserLocks.data?.some((lock) => lock.chapter_id === chapterId)

  if (getUserLocks.isError) {
    return <ErrorBanner variant={"readOnly"} error={getUserLocks.error} />
  }

  if (getUserLocks.isLoading) {
    return <Spinner variant={"medium"} />
  }

  if (isLocked) {
    return (
      <div
        className={css`
          margin: 2rem 0;
        `}
      >
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
      </div>
    )
  }

  // Show animation overlay when locking
  if (showAnimation) {
    return (
      <div
        className={css`
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: grid;
          place-items: center;
          background: rgba(255, 255, 255, 0.95);
        `}
      >
        <LockAnimation onComplete={handleAnimationComplete} size={200} />
      </div>
    )
  }

  return (
    <div
      className={css`
        margin: 2rem 0;
      `}
    >
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
            onClick={() => lockMutation.mutate()}
            disabled={lockMutation.isPending}
            className={css`
              width: 100%;
            `}
          >
            {lockMutation.isPending ? t("locking-chapter") : t("lock-chapter")}
          </Button>
          {lockMutation.isError && <ErrorBanner variant={"readOnly"} error={lockMutation.error} />}
        </div>
      </div>
    </div>
  )
}

export default LockChapter
