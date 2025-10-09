"use client"

import { useParams } from "next/navigation"
import { useTranslation } from "react-i18next"

import HistoryView from "@/components/page-specific/manage/pages/id/history/HistoryView"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"

const History: React.FC = () => {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()

  if (typeof id !== "string") {
    return (
      <div>
        <h1>{t("error-title")}</h1>
        <pre>{t("message-invalid-query")}</pre>
      </div>
    )
  }

  return (
    <div>
      <h2>{t("title-page-edit-history")}</h2>
      <HistoryView pageId={id} />
    </div>
  )
}

export default withSignedIn(History)
