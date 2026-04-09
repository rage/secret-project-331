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
import { downloadCodeGiveawayCodesCsv } from "@/generated/api/sdk.generated"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { baseTheme, headingFont, typography } from "@/shared-module/common/styles"

const BLOB_PARSE_AS = "blob" as const
const CODE_GIVEAWAY_CODES_CSV_PREFIX = "code-giveaway-"
const CODE_GIVEAWAY_CODES_CSV_SUFFIX = "-codes.csv"

const downloadBlobAsFile = (blob: Blob, fileName: string) => {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.setAttribute("download", fileName)
  try {
    document.body.appendChild(link)
    link.click()
    link.parentNode?.removeChild(link)
  } finally {
    window.URL.revokeObjectURL(url)
  }
}

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

  const [revealCodes, setRevealCodes] = useState(false)

  const codeGiveawayCodesQuery = useQuery(
    getCodeGiveawayCodesOptions({
      path: {
        id,
      },
    }),
  )
  const downloadCodesCsvMutation = useToastMutation(
    async () => {
      const data: unknown = await downloadCodeGiveawayCodesCsv({
        parseAs: BLOB_PARSE_AS,
        path: {
          id,
        },
        throwOnError: true,
      })

      if (!(data instanceof Blob)) {
        throw new Error("Invalid code giveaway CSV response")
      }

      return data
    },
    {
      notify: true,
      method: "POST",
    },
    {
      onSuccess: (blob) => {
        downloadBlobAsFile(
          blob,
          `${CODE_GIVEAWAY_CODES_CSV_PREFIX}${id}${CODE_GIVEAWAY_CODES_CSV_SUFFIX}`,
        )
      },
    },
  )

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

      <div
        className={css`
          margin-top: 1rem;
        `}
      >
        <Button size="medium" variant="primary" onClick={() => setRevealCodes(!revealCodes)}>
          {t(revealCodes ? "hide" : "reveal")}
        </Button>
        <Button
          size="medium"
          variant="primary"
          className={css`
            margin-top: 1rem;
          `}
          onClick={() => {
            downloadCodesCsvMutation.mutate()
          }}
        >
          {t("link-export-given-codes-as-csv")}
        </Button>
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
