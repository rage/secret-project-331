"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import CodeGiveawayCode from "./CodeGiveawayCode"
import ImportCodesForm from "./ImportCodesForm"

import FullWidthTable, { FullWidthTableRow } from "@/components/tables/FullWidthTable"
import {
  getCodeGiveawayByIdOptions,
  getCodeGiveawayCodesOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import Button from "@/shared-module/common/components/Button"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import { baseTheme, headingFont, typography } from "@/shared-module/common/styles"
import { QueryResults } from "@/shared-module/components"

const CodeGiveawayPage = () => {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const codeGiveawayQuery = useQuery(
    getCodeGiveawayByIdOptions({
      path: {
        id,
      },
    }),
  )

  usePageTitle(codeGiveawayQuery.data?.name ?? null)

  const [revealCodes, setRevealCodes] = useState(false)

  const codeGiveawayCodesQuery = useQuery(
    getCodeGiveawayCodesOptions({
      path: {
        id,
      },
    }),
  )

  const renderPage = (name: string, codes: typeof codeGiveawayCodesQuery.data) => (
    <>
      <h1
        className={css`
          font-size: ${typography.h4};
          color: ${baseTheme.colors.gray[700]};
          font-family: ${headingFont};
          font-weight: bold;
        `}
      >
        {t("heading-code-giveaway-name", { name })}
      </h1>

      <div
        className={css`
          margin-top: 1rem;
        `}
      >
        <Button size="medium" variant="primary" onClick={() => setRevealCodes(!revealCodes)}>
          {t(revealCodes ? "hide" : "reveal")}
        </Button>
        <a href={`/api/v0/main-frontend/code-giveaways/${id}/codes/csv`} download>
          <Button
            size="medium"
            variant="primary"
            type="button"
            className={css`
              margin-top: 1rem;
            `}
          >
            {t("link-export-given-codes-as-csv")}
          </Button>
        </a>
      </div>
      <FullWidthTable>
        <thead>
          <FullWidthTableRow>
            <th>{t("code")}</th>
            <th>{t("user-id")}</th>
            <th>{t("added-by-user")}</th>
          </FullWidthTableRow>
        </thead>
        <tbody>
          {codes &&
            codes.map((code) => (
              <CodeGiveawayCode key={code.id} code={code} revealed={revealCodes} />
            ))}
        </tbody>
      </FullWidthTable>
      <Button size="medium" variant="primary" onClick={() => setImportDialogOpen(true)}>
        {t("button-text-import")}
      </Button>
      <ImportCodesForm
        codeGiveawayId={id.toString()}
        dialogOpen={importDialogOpen}
        setDialogOpen={setImportDialogOpen}
        onCreated={() => {
          codeGiveawayCodesQuery.refetch()
        }}
      />
    </>
  )

  return (
    <QueryResults
      queries={[codeGiveawayQuery, codeGiveawayCodesQuery] as const}
      renderData={([codeGiveaway, codes]) => renderPage(codeGiveaway?.name ?? "", codes)}
      treatEmptyAsData
    />
  )
}

export default CodeGiveawayPage
