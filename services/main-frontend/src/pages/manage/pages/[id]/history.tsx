import { css } from "@emotion/css"
import { useRouter } from "next/router"
import { useTranslation } from "react-i18next"

import HistoryView from "../../../../components/HistoryView"
import Layout from "../../../../components/Layout"
import { normalWidthCenteredComponentStyles } from "../../../../shared-module/styles/componentStyles"

const History: React.FC<unknown> = () => {
  const { t } = useTranslation()
  const router = useRouter()
  const id = router.query.id

  if (typeof id !== "string") {
    return (
      <div>
        <h1>{t("error-title")}</h1>
        <pre>{t("message-invalid-query")}</pre>
      </div>
    )
  }

  return (
    <Layout navVariant="complex">
      <div
        className={css`
          ${normalWidthCenteredComponentStyles}
        `}
      >
        <h2>{t("title-page-edit-history")}</h2>
        <HistoryView pageId={id} />
      </div>
    </Layout>
  )
}

export default History
