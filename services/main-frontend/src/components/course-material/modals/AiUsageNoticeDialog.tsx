"use client"

import { css } from "@emotion/css"
import { useQueryClient } from "@tanstack/react-query"
import React from "react"
import { useForm } from "react-hook-form"
import { Trans, useTranslation } from "react-i18next"

import { getAiUsageNoticeAcknowledgementQueryKey } from "@/generated/course-material-api/@tanstack/react-query.generated"
import { acknowledgeAiUsageNotice } from "@/generated/course-material-api/sdk.generated"
import type { CourseAiPolicy } from "@/generated/course-material-api/types.generated"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import StandardDialog from "@/shared-module/common/components/dialogs/StandardDialog"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { baseTheme } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Checkbox } from "@/shared-module/components"

// The University of Helsinki guidelines on using AI to support learning.
// Only fi/sv/en versions are published; other languages fall back to the English page.
const GUIDELINES_URL_FI =
  "https://studies.helsinki.fi/ohjeet/artikkeli/tekoalyn-kayttaminen-oppimisen-tukena"
const GUIDELINES_URL_SV =
  "https://studies.helsinki.fi/instruktioner/artikel/anvandning-av-ai-som-stod-inlarning"
const GUIDELINES_URL_EN =
  "https://studies.helsinki.fi/instructions/article/using-ai-support-learning"

export interface AiUsageNoticeDialogProps {
  courseId: string
  /** The teacher-selected AI policy; `NotSet` shows the generic default message. */
  aiPolicy: CourseAiPolicy
  /**
   * Whether the course material itself contains AI instructions: `true` = yes, `false` = no,
   * `null`/`undefined` = unknown. Controls the guidelines link.
   */
  courseMaterialAiInstructions: boolean | null | undefined
  onClose: () => void
}

interface AiUsageNoticeFormFields {
  agreed: boolean
}

const AiUsageNoticeDialog: React.FC<React.PropsWithChildren<AiUsageNoticeDialogProps>> = ({
  courseId,
  aiPolicy,
  courseMaterialAiInstructions,
  onClose,
}) => {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()

  // studies.helsinki.fi publishes this page in fi/sv/en; other languages use the English version.
  const guidelinesUrl = /^fi(?:-|$)/.test(i18n.language)
    ? GUIDELINES_URL_FI
    : /^sv(?:-|$)/.test(i18n.language)
      ? GUIDELINES_URL_SV
      : GUIDELINES_URL_EN

  const { control, watch } = useForm<AiUsageNoticeFormFields>({
    defaultValues: { agreed: false },
  })
  const agreed = watch("agreed")

  // The link content is provided by the translation string via <Trans>, so the anchor has no
  // static children here.
  // eslint-disable-next-line jsx-a11y/anchor-has-content
  const guidelinesLink = <a href={guidelinesUrl} target="_blank" rel="noopener noreferrer" />

  const paragraphStyle = css`
    margin: 0;
  `

  // When the course material has its own AI instructions (true), students are pointed to those and
  // the general university-guidelines link is omitted. Otherwise (false / unknown) the link is shown.
  const showGuidelinesLink = courseMaterialAiInstructions !== true

  // Whether any guidelines link is actually rendered: always in the default message, and in the
  // adapted message only when the course material has no instructions of its own. The agree
  // checkbox only mentions "the linked guidelines" when such a link is present.
  const guidelinesLinkShown = aiPolicy === "NotSet" || showGuidelinesLink

  // The manual-review apology fits policies that restrict AI, but reads oddly where AI use is
  // encouraged, so it is hidden for the permissive policies.
  const showStaffReviewNote = aiPolicy !== "FullUse" && aiPolicy !== "Required"

  // The paragraph describing the teacher-selected policy. Only used when a policy is set; when it is
  // `NotSet` the dialog shows the generic default message instead.
  const policyParagraph = (): string | null => {
    switch (aiPolicy) {
      case "NoAi":
        return t("ai-usage-notice-policy-no-ai")
      case "PlanningOnly":
        return t("ai-usage-notice-policy-planning-only")
      case "Limited":
        return t("ai-usage-notice-policy-limited")
      case "FullUse":
        return t("ai-usage-notice-policy-full-use")
      case "Required":
        return t("ai-usage-notice-policy-required")
      default:
        return null
    }
  }

  const acknowledgeMutation = useToastMutation<void, unknown, void>(
    async () => {
      await acknowledgeAiUsageNotice({ path: { course_id: courseId } })
      await queryClient.invalidateQueries({
        queryKey: getAiUsageNoticeAcknowledgementQueryKey({ path: { course_id: courseId } }),
      })
      onClose()
    },
    { notify: false },
  )

  return (
    <StandardDialog
      open={true}
      title={t("ai-usage-notice-title")}
      leftAlignTitle={true}
      showCloseButton={false}
      closeable={false}
    >
      <div
        className={css`
          display: flex;
          flex-direction: column;
          gap: 1rem;
          line-height: 1.55;
        `}
      >
        {acknowledgeMutation.isError && (
          <ErrorBanner variant={"readOnly"} error={acknowledgeMutation.error} />
        )}
        {aiPolicy === "NotSet" ? (
          <p className={paragraphStyle}>
            <Trans
              t={t}
              i18nKey="ai-usage-notice-paragraph-1"
              components={{
                guidelinesLink,
              }}
            />
          </p>
        ) : (
          <>
            <p className={paragraphStyle}>{policyParagraph()}</p>
            {showGuidelinesLink ? (
              <p className={paragraphStyle}>
                <Trans
                  t={t}
                  i18nKey="ai-usage-notice-follow-guidelines"
                  components={{
                    guidelinesLink,
                  }}
                />
              </p>
            ) : (
              // The course material holds the exact policy; point students to it.
              <p className={paragraphStyle}>{t("ai-usage-notice-see-course-instructions")}</p>
            )}
          </>
        )}
        {showStaffReviewNote && (
          <p
            className={css`
              margin: 0;
              color: ${baseTheme.colors.gray[600]};
            `}
          >
            {t("ai-usage-notice-paragraph-2")}
          </p>
        )}
        <div data-testid="ai-usage-notice-agree-checkbox">
          <Checkbox
            name="agreed"
            control={control}
            label={
              guidelinesLinkShown
                ? t("ai-usage-notice-agree-checkbox")
                : t("ai-usage-notice-agree-checkbox-no-link")
            }
          />
        </div>
        <div
          className={css`
            display: flex;
            justify-content: flex-end;
          `}
        >
          <Button
            variant="primary"
            size="medium"
            disabled={!agreed || acknowledgeMutation.isPending}
            onClick={() => acknowledgeMutation.mutate()}
            data-testid="ai-usage-notice-acknowledge-button"
          >
            {t("ai-usage-notice-acknowledge-button")}
          </Button>
        </div>
      </div>
    </StandardDialog>
  )
}

export default withErrorBoundary(AiUsageNoticeDialog)
