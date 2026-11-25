"use client"

import { useInfiniteQuery } from "@tanstack/react-query"
import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { getAccountFormDecisions, lookupAccountFormDecisions } from "@/generated/api/sdk.generated"
import type { AccountFormDecision } from "@/generated/api/types.generated"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import {
  Button,
  EmptyState,
  ErrorNotice,
  LoadingRegion,
  TextField,
} from "@/shared-module/components"

import DecisionsTable from "./DecisionsTable"
import { stackCss, toolbarCss } from "./shared"

// Matches DECISION_PAGE_SIZE in the backend; a shorter page is the last one.
const DECISION_PAGE_SIZE = 100

const DECISIONS_QUERY_KEY = ["account-form-decisions"]

/** The previous page's last row, where the next page continues. */
interface DecisionCursor {
  before: string
  before_id: string
}

async function fetchDecisions(cursor: DecisionCursor | null) {
  const page = await getAccountFormDecisions({ query: cursor ?? {} })
  return page ?? []
}

function nextCursor(page: AccountFormDecision[]): DecisionCursor | undefined {
  const last = page[page.length - 1]
  return page.length === DECISION_PAGE_SIZE && last
    ? { before: last.created_at, before_id: last.id }
    : undefined
}

interface LookupFields {
  email: string
}

/** The log, newest first, and a lookup of the logged submissions about one address. */
const DecisionsSection: React.FC = () => {
  const { t } = useTranslation()
  const decisionsQuery = useInfiniteQuery({
    queryKey: DECISIONS_QUERY_KEY,
    initialPageParam: null as DecisionCursor | null,
    queryFn: ({ pageParam }) => fetchDecisions(pageParam),
    getNextPageParam: nextCursor,
  })
  const lookup = useToastMutation(
    (email: string) => lookupAccountFormDecisions({ body: { email } }),
    { notify: false },
  )
  const { control, handleSubmit } = useForm<LookupFields>({ defaultValues: { email: "" } })

  const submitLookup = handleSubmit((fields) => {
    lookup.mutate(fields.email.trim())
  })

  const decisions = decisionsQuery.data?.pages.flat() ?? []

  return (
    <div className={stackCss}>
      <form onSubmit={submitLookup} className={toolbarCss} noValidate>
        <TextField
          name="email"
          control={control}
          type="email"
          label={t("account-forms-lookup-email-label")}
          rules={{ required: t("required-field") }}
        />
        <Button type="submit" variant="secondary" size="medium" isLoading={lookup.isPending}>
          {t("account-forms-lookup-button")}
        </Button>
      </form>
      {lookup.isError && <ErrorNotice error={lookup.error} />}
      {lookup.isSuccess &&
        (lookup.data.length === 0 ? (
          <EmptyState title={t("account-forms-lookup-empty")} />
        ) : (
          <DecisionsTable decisions={lookup.data} caption={t("account-forms-lookup-results")} />
        ))}

      <h3>{t("account-forms-latest-decisions")}</h3>
      {decisionsQuery.isError && <ErrorNotice error={decisionsQuery.error} />}
      {decisionsQuery.isLoading && <LoadingRegion />}
      {decisionsQuery.isSuccess &&
        (decisions.length === 0 ? (
          <EmptyState title={t("account-forms-decisions-empty")} />
        ) : (
          <DecisionsTable decisions={decisions} caption={t("account-forms-latest-decisions")} />
        ))}
      {decisionsQuery.hasNextPage && (
        <div>
          <Button
            variant="secondary"
            size="medium"
            isLoading={decisionsQuery.isFetchingNextPage}
            onClick={() => void decisionsQuery.fetchNextPage()}
          >
            {t("account-forms-load-older")}
          </Button>
        </div>
      )}
    </div>
  )
}

export default DecisionsSection
