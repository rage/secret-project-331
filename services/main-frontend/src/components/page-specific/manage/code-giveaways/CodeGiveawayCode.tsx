import React from "react"
import { useTranslation } from "react-i18next"

import { FullWidthTableRow } from "@/components/tables/FullWidthTable"
import { CodeGiveawayCode as CodeGiveawayCodeType } from "@/shared-module/common/bindings"

interface CodeGiveawayCodeProps {
  code: CodeGiveawayCodeType
  revealed: boolean
}

const CodeGiveawayCode: React.FC<CodeGiveawayCodeProps> = ({ code, revealed }) => {
  const { t } = useTranslation()

  const { code_given_to_user_id, added_by_user_id, code: codeValue } = code

  return (
    <FullWidthTableRow>
      <td>{revealed ? <code>{codeValue}</code> : <code>******</code>}</td>
      <td>{code_given_to_user_id ? code_given_to_user_id : t("not-given")}</td>
      <td>{added_by_user_id}</td>
    </FullWidthTableRow>
  )
}

export default CodeGiveawayCode
