"use client"
import { css } from "@emotion/css"
import { Padlock } from "@vectopus/atlas-icons-react"
import React from "react"
import { useTranslation } from "react-i18next"

import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import { baseTheme, primaryFont } from "@/shared-module/common/styles"

interface LockChapterUnlockedViewProps {
  onLock: () => void
  isLocking: boolean
  error: Error | null
}

const LockChapterUnlockedView: React.FC<LockChapterUnlockedViewProps> = ({
  onLock,
  isLocking,
  error,
}) => {
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

export default LockChapterUnlockedView
