import { css } from "@emotion/css"
import { faCheck as icon } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import Link from "next/link"
import { useTranslation } from "react-i18next"

import Layout from "../components/Layout"
import Button from "../shared-module/components/Button"
import { baseTheme } from "../shared-module/styles"

const EmailVerifiedPage: React.FC<React.PropsWithChildren<unknown>> = () => {
  const { t } = useTranslation()
  return (
    <Layout>
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
          <FontAwesomeIcon
            icon={icon}
            className={css`
              color: ${baseTheme.colors.green[500]};
              margin-right: 0.5rem;
            `}
          />{" "}
          {t("message-your-email-has-been-verified")}
        </h1>
      </div>

      <Link href="/">
        <Button size="medium" variant="primary">
          {t("home-page")}
        </Button>
      </Link>
    </Layout>
  )
}

export default EmailVerifiedPage
