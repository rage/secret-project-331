"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import { CopyButton } from "@/shared-module/components"

import { emptyStateCss, payloadCss } from "../styles"

const JSON_INDENT = 2

/** One stored JSON body: pretty-printed and copyable, or the note that none was kept. */
const PayloadBlock: React.FC<{ body: unknown }> = ({ body }) => {
  const { t } = useTranslation()
  const text = body === null || body === undefined ? "" : JSON.stringify(body, null, JSON_INDENT)
  if (text === "") {
    return <p className={emptyStateCss}>{t("credit-registration-admin-no-body-stored")}</p>
  }
  return (
    <>
      <pre className={payloadCss}>{text}</pre>
      <CopyButton value={text} label={t("credit-registration-admin-copy-stored-body")} />
    </>
  )
}

export default PayloadBlock
