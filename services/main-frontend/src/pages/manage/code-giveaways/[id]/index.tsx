import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/router"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import CodeGiveawayCode from "@/components/page-specific/manage/code-giveaways/CodeGiveawayCode"
import ImportCodesForm from "@/components/page-specific/manage/code-giveaways/ImportCodesForm"
import FullWidthTable, { FullWidthTableRow } from "@/components/tables/FullWidthTable"
import { fetchCodeGiveawayById, fetchCodesByCodeGiveawayId } from "@/services/backend/codeGiveaways"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { baseTheme, headingFont, typography } from "@/shared-module/common/styles"

const CodesWrapper = styled.div`
  margin: 2rem 0;
`

const CodeGiveawayPage = () => {
  const router = useRouter()
  const { id } = router.query
  const { t } = useTranslation()
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const codeGiveawayQuery = useQuery({
    queryKey: ["code-giveaway", id],
    queryFn: () => fetchCodeGiveawayById(id!.toString()),
  })

  const [revealCodes, setRevealCodes] = useState(false)

  const codeGiveawayCodesQuery = useQuery({
    queryKey: ["code-giveaway-codes", id],
    queryFn: () => fetchCodesByCodeGiveawayId(id!.toString()),
  })

  if (codeGiveawayQuery.isLoading || codeGiveawayCodesQuery.isLoading) {
    return <Spinner variant="medium" />
  }

  if (codeGiveawayQuery.isError || codeGiveawayCodesQuery.isError) {
    return (
      <ErrorBanner
        variant="readOnly"
        error={codeGiveawayQuery.error || codeGiveawayCodesQuery.error}
      />
    )
  }

  return (
    <>
      <h1
        className={css`
          font-size: ${typography.h4};
          color: ${baseTheme.colors.gray[700]};
          font-family: ${headingFont};
          font-weight: bold;
        `}
      >
        {t("heading-code-giveaway-name", { name: codeGiveawayQuery.data?.name ?? "" })}
      </h1>

      <Button
        size="medium"
        variant="primary"
        onClick={() => setRevealCodes(!revealCodes)}
        className={css`
          margin-top: 1rem;
        `}
      >
        {t(revealCodes ? "hide" : "reveal")}
      </Button>
      <FullWidthTable>
        <thead>
          <FullWidthTableRow>
            <th>{t("code")}</th>
            <th>{t("user-id")}</th>
            <th>{t("added-by-user")}</th>
          </FullWidthTableRow>
        </thead>
        <tbody>
          {codeGiveawayCodesQuery.data &&
            codeGiveawayCodesQuery.data.map((code) => (
              <CodeGiveawayCode key={code.id} code={code} revealed={revealCodes} />
            ))}
        </tbody>
      </FullWidthTable>
      <Button size="medium" variant="primary" onClick={() => setImportDialogOpen(true)}>
        {t("button-text-import")}
      </Button>
      <ImportCodesForm
        codeGiveawayId={id!.toString()}
        dialogOpen={importDialogOpen}
        setDialogOpen={setImportDialogOpen}
        onCreated={() => {
          codeGiveawayCodesQuery.refetch()
        }}
      />
    </>
  )
}

export default CodeGiveawayPage
