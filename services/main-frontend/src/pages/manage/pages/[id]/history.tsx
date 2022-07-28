import { useRouter } from "next/router"
import { useTranslation } from "react-i18next"

import Layout from "../../../../components/Layout"
import HistoryView from "../../../../components/page-specific/manage/pages/id/history/HistoryView"

const History: React.FC<React.PropsWithChildren<unknown>> = () => {
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
    <Layout navVariant="simple">
      <div>
        <h2>{t("title-page-edit-history")}</h2>
        <HistoryView pageId={id} />
      </div>
    </Layout>
  )
}

export default History
