import { css } from "@emotion/css"
import { Envelope } from "@vectopus/atlas-icons-react"
import Link from "next/link"
import { useTranslation } from "react-i18next"

import Button from "@/shared-module/common/components/Button"
import { baseTheme } from "@/shared-module/common/styles"

const AccountDeletedPage: React.FC = () => {
  const { t } = useTranslation()
  return (
    <>
      <div
        className={css`
          background-color: ${baseTheme.colors.green[100]};
          padding: 3rem;
          margin-bottom: 1rem;

          h1 {
            font-size: 2rem;
          }
        `}
      >
        <h1>
          <Envelope
            className={css`
              color: ${baseTheme.colors.green[500]};
              margin-right: 0.5rem;
            `}
          />
          {t("message-your-account-has-been-deleted")}
        </h1>
      </div>

      <Link href="/">
        <Button size="medium" variant="primary">
          {t("home-page")}
        </Button>
      </Link>
    </>
  )
}

export default AccountDeletedPage
