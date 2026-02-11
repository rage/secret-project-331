"use client"

import { css } from "@emotion/css"
import { useTranslation } from "react-i18next"

import DetailRow from "./DetailRow"

import { UserDetail } from "@/shared-module/common/bindings"
import { primaryFont } from "@/shared-module/common/styles"

export function UserDetailsContent({ data, userId }: { data: UserDetail; userId: string }) {
  const { t } = useTranslation()

  return (
    <div
      className={css`
        font-family: ${primaryFont};
      `}
    >
      <DetailRow label={t("label-user-id")} value={userId} />
      <DetailRow label={t("label-first-name")} value={data.first_name?.trim() || "-"} />
      <DetailRow label={t("label-last-name")} value={data.last_name?.trim() || "-"} />
      <DetailRow label={t("label-email")} value={data.email || "-"} />
      <DetailRow label={t("country")} value={data.country?.trim() || "-"} />
    </div>
  )
}
