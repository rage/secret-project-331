"use client"

import { css, cx } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import {
  adminManuallyLinkStudentNumber,
  adminResolveStudentNumberForLinking,
  searchUserDetailsByEmail,
  searchUserDetailsByOtherDetails,
} from "@/generated/api/sdk.generated"
import type {
  AdminManuallyLinkStudentNumberResult,
  AdminResolveStudentNumberResult,
  UserDetail,
} from "@/generated/api/types.generated"
import { formatUserName } from "@/hooks/useUserDetails"
import type { DialogAction } from "@/shared-module/components"
import {
  Button,
  Checkbox,
  DescriptionList,
  Dialog,
  Infobox,
  RelativeTime,
  TextField,
} from "@/shared-module/components"

import {
  ABSENT,
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  BUTTON_TERTIARY,
  CREDIT_REGISTRATION_NS,
  MIDDLE_DOT,
  STACKED,
  TONE,
} from "../constants"
import {
  controlCss,
  controlsCss,
  dialogFormCss,
  dividedListCss,
  noteCss,
  spacedRowCss,
  subheadingCss,
} from "../styles"
import { useActionResult } from "../useActionResult"
import { manualLinkOutcomeLabel, sendStatusLabel } from "./adminCreditRegistrationCopy"
import { useInvalidateAfterLinkingChange } from "./adminCreditRegistrationHooks"
import { ReasonField, useReasonRequiredForm } from "./ReasonConfirmDialog"
import StudentCell from "./StudentCell"

/** The account a student number is about to be linked to, as much of it as a human can check. */
export interface ManualLinkAccount {
  userId: string
  name: string
  email: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  /** Seeds the number field; the preview still has to be run against it. */
  studentNumber?: string
  /** Seeds the account, where the caller already knows whose row this is. */
  account?: ManualLinkAccount
}

interface Fields {
  student_number: string
  resending_cannot_work: boolean
  reason: string
}

const LINKED = "linked"
/** Enough to recognise the right person; a longer list means the search was too vague to trust. */
const MAX_ACCOUNT_MATCHES = 8

/** The name Sisu holds beside the name on the account, which is the comparison being asserted. */
const identityMatchCss = css`
  display: grid;
  gap: var(--space-4);
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
`

const identityCss = css`
  display: grid;
  gap: var(--space-1);
`

const accountResultsCss = css`
  max-height: 14rem;
  overflow-y: auto;
`

const searchAccounts = async (query: string): Promise<UserDetail[]> => {
  const [byEmail, byOtherDetails] = await Promise.all([
    searchUserDetailsByEmail({ body: { query } }),
    searchUserDetailsByOtherDetails({ body: { query } }),
  ])
  const byUserId = new Map<string, UserDetail>()
  for (const user of [...byEmail, ...byOtherDetails]) {
    byUserId.set(user.user_id, user)
  }
  return Array.from(byUserId.values()).slice(0, MAX_ACCOUNT_MATCHES)
}

interface SearchFields {
  term: string
}

/** Picks the account by name or email, because nobody can check a uuid against a person. */
const AccountPicker: React.FC<{
  onChoose: (account: ManualLinkAccount) => void
  /** Whether this is the wizard's current step, so its button reads as the thing to do next. */
  isCurrentStep: boolean
}> = ({ onChoose, isCurrentStep }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const { control, handleSubmit } = useForm<SearchFields>({ defaultValues: { term: "" } })
  const [query, setQuery] = useState("")
  const accountsQuery = useQuery({
    queryKey: ["manualLinkAccountSearch", query],
    queryFn: () => searchAccounts(query),
    enabled: query !== "",
  })

  return (
    <div className={dialogFormCss}>
      <form className={controlsCss} onSubmit={handleSubmit(({ term }) => setQuery(term.trim()))}>
        <TextField
          name="term"
          control={control}
          className={controlCss}
          label={t("credit-registration-admin-manual-link-account-search")}
        />
        <Button
          type="submit"
          variant={isCurrentStep ? BUTTON_PRIMARY : BUTTON_SECONDARY}
          size="medium"
          disabled={accountsQuery.isFetching}
        >
          {t("button-text-search")}
        </Button>
      </form>
      {accountsQuery.data && accountsQuery.data.length === 0 && (
        <p className={noteCss}>{t("credit-registration-admin-manual-link-no-accounts")}</p>
      )}
      {accountsQuery.data &&
        accountsQuery.data.length > 0 && (
          // oxlint-disable-next-line jsx-a11y/no-redundant-roles -- list-style: none makes VoiceOver drop the implicit list role
          <ul className={cx(dividedListCss, accountResultsCss)} role="list">
            {accountsQuery.data.map((user) => (
              <li key={user.user_id} className={spacedRowCss}>
                <StudentCell row={user} />
                <Button
                  variant={BUTTON_TERTIARY}
                  size="small"
                  onClick={() =>
                    onChoose({
                      userId: user.user_id,
                      name: formatUserName(user),
                      email: user.email,
                    })
                  }
                >
                  {t("credit-registration-admin-manual-link-choose-account")}
                </Button>
              </li>
            ))}
          </ul>
        )}
    </div>
  )
}

/** The API enforces the same two gates: the preview must have run, and a reason is required. */
const AdminManualLinkDialog: React.FC<Props> = ({ open, onClose, studentNumber, account }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const invalidateAfterLinkingChange = useInvalidateAfterLinkingChange()
  const [chosenAccount, setChosenAccount] = useState<ManualLinkAccount | null>(account ?? null)
  const { control, handleSubmit, watch } = useReasonRequiredForm<Fields>({
    student_number: studentNumber ?? "",
    resending_cannot_work: false,
    reason: "",
  })
  const fields = watch()

  const { result: preview, mutation: previewMutation } = useActionResult<
    AdminResolveStudentNumberResult,
    string
  >((number) => adminResolveStudentNumberForLinking({ body: { student_number: number } }))
  const { result, mutation: linkMutation } = useActionResult<
    AdminManuallyLinkStudentNumberResult,
    Fields
  >(
    (values) =>
      adminManuallyLinkStudentNumber({
        body: {
          user_id: chosenAccount?.userId ?? "",
          student_number: values.student_number.trim(),
          // Echoed from the preview; the endpoint re-resolves and refuses if it no longer matches.
          sisu_person_id: preview?.sisu_person_id ?? "",
          reason: values.reason,
        },
      }),
    () => {
      // Linking resolves waiting registrations synchronously, so their state changes too.
      void invalidateAfterLinkingChange()
    },
  )

  // The two preconditions the endpoint refuses without; the reason and the checkbox are the form's.
  const isResolved =
    preview?.found === true && preview.sisu_person_id !== null && chosenAccount !== null

  const submit = handleSubmit((values) => linkMutation.mutate(values))
  const actions: readonly [DialogAction] = [
    {
      label: t("credit-registration-admin-manual-link-confirm"),
      variant: BUTTON_PRIMARY,
      isLoading: linkMutation.isPending,
      disabled: !isResolved,
      onPress: () => void submit(),
    },
  ]

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("credit-registration-admin-manual-link-title")}
      actions={actions}
    >
      <div className={dialogFormCss}>
        <Infobox tone={TONE.WARNING}>{t("credit-registration-admin-manual-link-warning")}</Infobox>
        <div className={controlsCss}>
          <TextField
            name="student_number"
            control={control}
            className={controlCss}
            label={t("label-student-number")}
          />
          <Button
            // A wizard reads top to bottom: this is the first thing to do until it is done.
            variant={preview?.found === true ? BUTTON_SECONDARY : BUTTON_PRIMARY}
            size="medium"
            disabled={previewMutation.isPending}
            onClick={() => previewMutation.mutate(fields.student_number.trim())}
          >
            {t("button-text-credit-registration-check-in-study-registry")}
          </Button>
        </div>
        {preview && (
          <Infobox tone={preview.found ? TONE.INFO : TONE.WARNING}>
            {preview.study_registry_unavailable ? (
              t("credit-registration-admin-manual-link-registry-unavailable")
            ) : preview.found ? (
              <div className={dialogFormCss}>
                <div className={identityMatchCss}>
                  <span className={identityCss}>
                    <span className={noteCss}>
                      {t("credit-registration-admin-manual-link-sisu-holds")}
                    </span>
                    <span>{`${preview.first_names ?? ABSENT} ${preview.last_name ?? ABSENT}`}</span>
                  </span>
                  <span className={identityCss}>
                    <span className={noteCss}>
                      {t("credit-registration-admin-manual-link-account-holds")}
                    </span>
                    <span>{chosenAccount?.name ?? ABSENT}</span>
                    <span className={noteCss}>{chosenAccount?.email ?? ABSENT}</span>
                  </span>
                </div>
                <DescriptionList
                  layout={STACKED}
                  items={[
                    {
                      label: t("label-credit-registration-person-id"),
                      value: <code>{preview.sisu_person_id ?? ABSENT}</code>,
                    },
                    {
                      label: t("label-credit-registration-already-linked-to"),
                      value:
                        preview.already_linked_to_user_email ??
                        t("credit-registration-admin-not-linked"),
                    },
                    {
                      label: t("credit-registration-admin-send-status-header"),
                      value:
                        preview.linking_emails.length === 0 ? (
                          t("credit-registration-admin-no-mails-sent")
                        ) : (
                          <ul>
                            {preview.linking_emails.map((mail) => (
                              <li key={mail.id}>
                                {mail.emailed_to}
                                {MIDDLE_DOT}
                                {sendStatusLabel(t, mail.send_status.email_send_status)}
                                {MIDDLE_DOT}
                                <RelativeTime at={mail.send_status.sent_at ?? mail.claimed_at} />
                              </li>
                            ))}
                          </ul>
                        ),
                    },
                  ]}
                />
              </div>
            ) : (
              t("credit-registration-admin-manual-link-not-found")
            )}
          </Infobox>
        )}
        <div className={dialogFormCss}>
          <h3 className={subheadingCss}>
            {t("credit-registration-admin-manual-link-account-heading")}
          </h3>
          {chosenAccount ? (
            <span className={spacedRowCss}>
              <span className={identityCss}>
                <span>{chosenAccount.name}</span>
                <span className={noteCss}>{chosenAccount.email ?? ABSENT}</span>
              </span>
              <Button
                variant={BUTTON_TERTIARY}
                size="small"
                onClick={() => setChosenAccount(null)}
                disabled={linkMutation.isPending}
              >
                {t("credit-registration-admin-manual-link-change-account")}
              </Button>
            </span>
          ) : (
            <AccountPicker onChoose={setChosenAccount} isCurrentStep={preview?.found === true} />
          )}
        </div>
        <form onSubmit={submit} className={dialogFormCss}>
          <Checkbox
            name="resending_cannot_work"
            control={control}
            rules={{ required: t("required-field") }}
            label={t("credit-registration-admin-manual-link-confirm-checkbox")}
          />
          <ReasonField
            control={control}
            description={t("credit-registration-admin-manual-link-reason-description")}
          />
        </form>
        {/* Immediately above the confirm button below, which stays disabled for exactly this. */}
        {!isResolved && (
          <p className={noteCss}>{t("credit-registration-admin-manual-link-preview-required")}</p>
        )}
        {result && (
          <Infobox tone={result.outcome === LINKED ? TONE.INFO : TONE.WARNING}>
            <div>{manualLinkOutcomeLabel(t, result.outcome)}</div>
            {result.affected_registration_count > 0 && (
              <div>
                {t("credit-registration-admin-manual-link-unblocked", {
                  count: result.affected_registration_count,
                })}
              </div>
            )}
          </Infobox>
        )}
      </div>
    </Dialog>
  )
}

export default AdminManualLinkDialog
