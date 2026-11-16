"use client"

import { css } from "@emotion/css"
import { MagnifyingGlass } from "@vectopus/atlas-icons-react"
import React, { useId } from "react"
import type { Key } from "react-aria"
import { useTranslation } from "react-i18next"

import { useAccountLinkingEmails } from "@/components/credit-registration/admin/adminCreditRegistrationHooks"
import LinkingEmailsTable from "@/components/credit-registration/admin/LinkingEmailsTable"
import {
  type FilterFieldDescriptor,
  useFilteredAdminQuery,
} from "@/components/credit-registration/admin/useFilteredAdminQuery"
import {
  ADMIN_PAGE_SIZE_OPTIONS,
  BUTTON_TERTIARY,
  CREDIT_REGISTRATION_NS,
  QUIET_REFRESH,
} from "@/components/credit-registration/constants"
import {
  controlsCss,
  headingCss,
  noteCss,
  sectionCardCss,
  sectionCardHeaderCss,
  sectionCss,
} from "@/components/credit-registration/styles"
import { useIsAccountLinkingEnabled } from "@/components/credit-registration/useIsAccountLinkingEnabled"
import type { LinkingEmailListStatus } from "@/generated/api/types.generated"
import { omitUndefined } from "@/shared-module/common/utils/nullability"
import {
  Button,
  EmptyState,
  Pagination,
  QueryResult,
  TextField,
  ToggleButtonGroup,
  ToggleButtonGroupButton,
} from "@/shared-module/components"

const ROWS_PER_PAGE = 50
const SEARCH_ICON_SIZE = 16

const PARAM_STATUS = "status"
const PARAM_ADDRESS = "address"

const STATUS_ALL = "all"
type StatusChoice = LinkingEmailListStatus | typeof STATUS_ALL
/** Left out of the URL, so the tab's plain link opens on it. */
const DEFAULT_STATUS: StatusChoice = "unused"
const STATUS_CHOICES: StatusChoice[] = ["unused", "used", "expired", "not_sent", STATUS_ALL]

const STATUS_LABEL_KEYS = {
  unused: "credit-registration-admin-linking-email-status-unused",
  used: "credit-registration-admin-linking-email-status-used",
  expired: "credit-registration-admin-linking-email-status-expired",
  not_sent: "credit-registration-admin-linking-email-status-not-sent",
  all: "credit-registration-admin-linking-email-status-all",
} as const satisfies Record<StatusChoice, string>

/** The status a URL param names; anything unrecognised falls back to the default. */
const statusFromParam = (raw: string | undefined): StatusChoice =>
  STATUS_CHOICES.find((choice) => choice === raw) ?? DEFAULT_STATUS

const searchCss = css`
  min-width: min(20rem, 100%);
  flex: 1 1 20rem;
`

const statusFilterCss = css`
  display: grid;
  gap: var(--space-2);
`

interface FilterFields {
  address: string
  status: Set<Key>
}

const STATUS_FIELD: FilterFieldDescriptor<FilterFields> = {
  param: PARAM_STATUS,
  field: "status",
  fromParam: (raw) => new Set<Key>([statusFromParam(raw)]),
  toParam: (value) => {
    const status = statusFromParam([...(value as Set<Key>)][0]?.toString())
    return status === DEFAULT_STATUS ? undefined : status
  },
}

/**
 * Every linking email ever queued, replaced ones too, newest first. An address search looks
 * through every status, so support finds a student's mail whatever became of it.
 */
const LinkingEmailsPage: React.FC = () => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const statusLabelId = useId()
  const canResend = useIsAccountLinkingEnabled()

  const { control, setValue, handleSubmit, param, applyParams, paginationInfo, query } =
    useFilteredAdminQuery<FilterFields, NonNullable<Parameters<typeof useAccountLinkingEmails>[0]>>(
      [STATUS_FIELD],
      (filters, pagination) => {
        const address = filters.param(PARAM_ADDRESS)
        const status = statusFromParam(filters.param(PARAM_STATUS))
        return {
          page: pagination.page,
          limit: pagination.limit,
          ...omitUndefined({
            address,
            status: address || status === STATUS_ALL ? undefined : status,
          }),
        }
      },
      {
        rowsPerPage: ROWS_PER_PAGE,
        manualDefaults: (filters) => ({ address: filters.param(PARAM_ADDRESS) ?? "" }),
      },
    )

  const searchedAddress = param(PARAM_ADDRESS)

  const clearSearch = () => {
    setValue("address", "")
    applyParams({ [PARAM_ADDRESS]: undefined })
  }

  const emailsQuery = useAccountLinkingEmails(query)

  return (
    <section className={sectionCardCss}>
      <div className={sectionCardHeaderCss}>
        <h2 className={headingCss}>{t("credit-registration-tab-linking-emails")}</h2>
      </div>
      <form
        className={controlsCss}
        onSubmit={handleSubmit((fields) => applyParams({ [PARAM_ADDRESS]: fields.address.trim() }))}
      >
        <div className={searchCss}>
          <TextField
            name="address"
            control={control}
            label={t("credit-registration-admin-linking-email-search-label")}
            description={t("credit-registration-admin-linking-email-search-description")}
            iconEnd={<MagnifyingGlass size={SEARCH_ICON_SIZE} />}
          />
        </div>
      </form>
      <div className={statusFilterCss}>
        <span id={statusLabelId} className={noteCss}>
          {t("credit-registration-admin-linking-email-status")}
        </span>
        <ToggleButtonGroup
          name="status"
          control={control}
          label={null}
          aria-labelledby={statusLabelId}
          isDisabled={searchedAddress !== undefined}
        >
          {STATUS_CHOICES.map((choice) => (
            <ToggleButtonGroupButton key={choice} id={choice}>
              {t(STATUS_LABEL_KEYS[choice])}
            </ToggleButtonGroupButton>
          ))}
        </ToggleButtonGroup>
        {searchedAddress !== undefined && (
          <span className={noteCss}>
            {t("credit-registration-admin-linking-email-search-all-statuses")}
          </span>
        )}
      </div>
      <QueryResult
        query={emailsQuery}
        refreshIndicator={QUIET_REFRESH}
        contentClassName={sectionCss}
      >
        {(page) => (
          <>
            {/* `Pagination` repeats this total from 2 pages on. */}
            {page.total_pages < 2 && page.total_count > 0 && (
              <p className={noteCss}>
                {t("credit-registration-admin-linking-email-count", { count: page.total_count })}
              </p>
            )}
            <LinkingEmailsTable
              rows={page.data}
              showsCourse
              canResend={canResend}
              emptyState={
                <EmptyState
                  title={t("credit-registration-admin-no-matching-linking-emails")}
                  action={
                    searchedAddress !== undefined && (
                      <Button variant={BUTTON_TERTIARY} size="small" onClick={clearSearch}>
                        {t("credit-registration-admin-clear-search")}
                      </Button>
                    )
                  }
                />
              }
            />
            <Pagination
              page={paginationInfo.page}
              onPageChange={paginationInfo.setPage}
              itemsPerPage={paginationInfo.limit}
              onItemsPerPageChange={paginationInfo.setLimit}
              totalPages={page.total_pages}
              totalItems={page.total_count}
              itemsPerPageOptions={ADMIN_PAGE_SIZE_OPTIONS}
            />
          </>
        )}
      </QueryResult>
    </section>
  )
}

export default LinkingEmailsPage
