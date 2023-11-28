import { css } from "@emotion/css"
import { ExclamationMessage } from "@vectopus/atlas-icons-react"
import React from "react"
import { useTranslation } from "react-i18next"

import Button from "../shared-module/components/Button"
import { baseTheme } from "../shared-module/styles"

interface Props {
  title: string
  show: boolean
  error?: string | null
  leftButtonText: string
  leftButtonDisabled?: boolean
  onClickLeft: () => void
  rightButtonText: string
  rightButtonDisabled?: boolean
  onClickRight: () => void
}

const BottomPanel: React.FC<Props> = ({
  title,
  show,
  error,
  leftButtonText,
  leftButtonDisabled,
  onClickLeft,
  rightButtonText,
  rightButtonDisabled,
  onClickRight,
}) => {
  const { t } = useTranslation()

  if (!show) {
    return <></>
  }

  return (
    <div
      className={css`
        padding: 1rem 2rem;
        position: fixed;
        bottom: 0px;
        margin: 5% auto;
        left: 0;
        right: 0;
        width: 90%;
        max-width: fit-content;
        z-index: 20;
        background-color: ${baseTheme.colors.clear[100]};
        box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.26);
        border-radius: 2px;
      `}
    >
      <div
        className={css`
          margin-top: 0.4rem;
          margin-bottom: 0.6rem;
          display: flex;
          align-items: center;
          font-weight: 600;
          color: ${baseTheme.colors.gray[500]};
        `}
      >
        <ExclamationMessage
          size={40}
          className={css`
            margin-right: 1rem;
            color: ${baseTheme.colors.gray[600]};
          `}
        />
        {title}
      </div>
      {error !== undefined && error !== null && (
        <div
          className={css`
            border-radius: 2px;
            padding: 1rem;
            margin-bottom: 0.6rem;
            color: ${baseTheme.colors.clear[200]};
            background-color: ${baseTheme.colors.red[700]};
          `}
        >{`${t("error-title")}: ${error}`}</div>
      )}
      <div
        className={css`
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
        `}
      >
        <Button variant="blue" size="medium" onClick={onClickLeft} disabled={leftButtonDisabled}>
          {leftButtonText}
        </Button>
        <Button
          variant="secondary"
          size="medium"
          onClick={onClickRight}
          disabled={rightButtonDisabled}
        >
          {rightButtonText}
        </Button>
      </div>
    </div>
  )
}

export default BottomPanel
