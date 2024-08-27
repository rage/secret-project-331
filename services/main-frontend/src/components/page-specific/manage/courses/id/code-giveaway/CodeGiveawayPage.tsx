import { css } from "@emotion/css"
import { useTranslation } from "react-i18next"

import { baseTheme, headingFont, typography } from "@/shared-module/common/styles"

const CodeGiveawayPage = () => {
  const { t } = useTranslation()
  return (
    <div>
      <h1
        className={css`
          font-size: ${typography.h4};
          color: ${baseTheme.colors.gray[700]};
          font-family: ${headingFont};
          font-weight: bold;
        `}
      >
        {t("heading-code-giveaway")}
      </h1>
    </div>
  )
}
export default CodeGiveawayPage
