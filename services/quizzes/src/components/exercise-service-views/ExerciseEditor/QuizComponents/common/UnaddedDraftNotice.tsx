import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

interface UnaddedDraftNoticeProps {
  visible: boolean
}

/** Warns that text typed into an add-form is not part of the quiz until its add button is pressed. */
const UnaddedDraftNotice: React.FC<UnaddedDraftNoticeProps> = ({ visible }) => {
  const { t } = useTranslation()
  if (!visible) {
    return null
  }
  return (
    <p
      role="status"
      className={css`
        color: #a45a00;
        font-size: 14px;
        margin: 8px 0 0;
      `}
    >
      {t("not-added-yet")}
    </p>
  )
}

export default UnaddedDraftNotice
