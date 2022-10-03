import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { baseTheme } from "../../../../../shared-module/styles"

const WaitingForPeerReviews: React.FC<React.PropsWithChildren<unknown>> = () => {
  const { t } = useTranslation()

  return (
    <div
      className={css`
        padding-top: 3rem;
      `}
    >
      <h3
        className={css`
          font-weight: 600;
          font-size: 36px;
          line-height: 50px;
          text-align: center;
          margin-bottom: 1rem;

          color: ${baseTheme.colors.grey[700]};
        `}
      >
        {t("title-waiting-for-peer-reviews")}
      </h3>

      <p>{t("waiting-for-peer-reviews-explanation")}</p>
    </div>
  )
}

export default WaitingForPeerReviews
