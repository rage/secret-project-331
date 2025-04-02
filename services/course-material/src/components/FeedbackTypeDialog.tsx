import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import StandardDialog from "@/shared-module/common/components/StandardDialog"
import { baseTheme } from "@/shared-module/common/styles"

interface Props {
  open: boolean
  onClose: () => void
  onSelectFeedback: () => void
  onSelectImprovement: () => void
}

const FeedbackTypeDialog: React.FC<Props> = ({
  open,
  onClose,
  onSelectFeedback,
  onSelectImprovement,
}) => {
  const { t } = useTranslation()

  return (
    <StandardDialog
      open={open}
      onClose={onClose}
      title={t("select-feedback-type")}
      width="normal"
      className={css`
        max-width: 600px;
      `}
    >
      <div
        className={css`
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding: 1rem;
        `}
      >
        <button
          onClick={() => {
            onSelectFeedback()
            onClose()
          }}
          className={css`
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 0.5rem;
            padding: 1.5rem;
            background: ${baseTheme.colors.clear[100]};
            border: 2px solid ${baseTheme.colors.gray[200]};
            border-radius: 8px;
            cursor: pointer;
            width: 100%;
            text-align: left;
            transition: all 0.2s ease;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);

            &:hover {
              background: ${baseTheme.colors.clear[200]};
              border-color: ${baseTheme.colors.gray[300]};
              box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            }

            &:focus {
              outline: none;
              box-shadow:
                0 0 0 2px ${baseTheme.colors.clear[100]},
                0 0 0 4px ${baseTheme.colors.gray[200]};
            }
          `}
        >
          <h3
            className={css`
              font-size: 1.25rem;
              font-weight: 600;
              margin: 0;
              color: ${baseTheme.colors.gray[700]};
            `}
          >
            {t("written-feedback")}
          </h3>
          <p
            className={css`
              margin: 0;
              color: ${baseTheme.colors.gray[500]};
              line-height: 1.5;
              font-size: 0.95rem;
            `}
          >
            {t("written-feedback-description")}
          </p>
        </button>

        <button
          onClick={() => {
            onSelectImprovement()
            onClose()
          }}
          className={css`
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 0.5rem;
            padding: 1.5rem;
            background: ${baseTheme.colors.clear[100]};
            border: 2px solid ${baseTheme.colors.gray[200]};
            border-radius: 8px;
            cursor: pointer;
            width: 100%;
            text-align: left;
            transition: all 0.2s ease;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);

            &:hover {
              background: ${baseTheme.colors.clear[200]};
              border-color: ${baseTheme.colors.gray[300]};
              box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            }

            &:focus {
              outline: none;
              box-shadow:
                0 0 0 2px ${baseTheme.colors.clear[100]},
                0 0 0 4px ${baseTheme.colors.gray[200]};
            }
          `}
        >
          <h3
            className={css`
              font-size: 1.25rem;
              font-weight: 600;
              margin: 0;
              color: ${baseTheme.colors.gray[700]};
            `}
          >
            {t("improve-material")}
          </h3>
          <p
            className={css`
              margin: 0;
              color: ${baseTheme.colors.gray[500]};
              line-height: 1.5;
              font-size: 0.95rem;
            `}
          >
            {t("improve-material-description")}
          </p>
        </button>
      </div>
    </StandardDialog>
  )
}

export default FeedbackTypeDialog
