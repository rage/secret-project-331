import { css } from "@emotion/css"
import { Envelope } from "@vectopus/atlas-icons-react"
import Link from "next/link"
import { useTranslation } from "react-i18next"

import Button from "../shared-module/components/Button"
import { baseTheme } from "../shared-module/styles"

const EmailVerifiedPage: React.FC<React.PropsWithChildren<unknown>> = () => {
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
          {t("message-your-email-has-been-verified")}
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

export default EmailVerifiedPage
