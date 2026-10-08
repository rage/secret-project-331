"use client"

import { css } from "@emotion/css"
import { useMutation } from "@tanstack/react-query"
import React, { useEffect } from "react"
import { useForm } from "react-hook-form"

import type { EmailTemplatePreviewRequest } from "@/generated/api"
import {
  previewCmsEmailTemplateMutation,
  sendCmsEmailTemplateTestMutation,
} from "@/generated/api/@tanstack/react-query.generated"
import Spinner from "@/shared-module/common/components/Spinner"
import {
  Dialog,
  getErrorMessage,
  Infobox,
  Radio,
  RadioGroup,
  TONE,
} from "@/shared-module/components"
import { useTranslation } from "@/utils/useCmsTranslation"

/* oxlint-disable i18next/no-literal-string */
const VIEW_HTML = "html"
const VIEW_PLAIN_TEXT = "plain-text"
const WIDTH_DESKTOP = "desktop"
const WIDTH_MOBILE = "mobile"
/* oxlint-enable i18next/no-literal-string */

const MOBILE_WIDTH_PX = 375

interface PreviewOptions {
  view: typeof VIEW_HTML | typeof VIEW_PLAIN_TEXT
  width: typeof WIDTH_DESKTOP | typeof WIDTH_MOBILE
}

interface EmailPreviewDialogProps {
  emailTemplateId: string
  /** The editor's unsaved state, normalised the way Save would store it; null closes the dialog. */
  draft: EmailTemplatePreviewRequest | null
  onClose: () => void
}

/** Shows the editor's unsaved email as the sender renders it, and sends it to the current user. */
const EmailPreviewDialog: React.FC<EmailPreviewDialogProps> = ({
  emailTemplateId,
  draft,
  onClose,
}) => {
  const { t } = useTranslation()
  const previewMutation = useMutation(previewCmsEmailTemplateMutation())
  const sendTestMutation = useMutation(sendCmsEmailTemplateTestMutation())
  const { control, watch } = useForm<PreviewOptions>({
    defaultValues: { view: VIEW_HTML, width: WIDTH_DESKTOP },
  })
  const view = watch("view")
  const width = watch("width")

  const { mutate: requestPreview, reset: resetPreview } = previewMutation
  const { reset: resetSendTest } = sendTestMutation
  useEffect(() => {
    if (!draft) {
      return
    }
    requestPreview({ path: { email_template_id: emailTemplateId }, body: draft })
    return () => {
      resetPreview()
      resetSendTest()
    }
  }, [draft, emailTemplateId, requestPreview, resetPreview, resetSendTest])

  const preview = previewMutation.data

  return (
    <Dialog
      open={draft !== null}
      onClose={onClose}
      size="wide"
      title={t("email-preview")}
      actions={[
        {
          label: t("send-test-email-to-me"),
          variant: "primary",
          isLoading: sendTestMutation.isPending,
          disabled: !preview || !draft,
          onClick: () => {
            if (draft) {
              sendTestMutation.mutate({ path: { email_template_id: emailTemplateId }, body: draft })
            }
          },
        },
      ]}
    >
      <div
        className={css`
          display: flex;
          flex-direction: column;
          gap: 1rem;
        `}
      >
        {previewMutation.isPending && <Spinner variant="medium" />}
        {previewMutation.isError && (
          <Infobox tone={TONE.DANGER} heading={t("email-preview-failed")}>
            {getErrorMessage(previewMutation.error)}
          </Infobox>
        )}
        {preview && (
          <>
            <div>
              <div
                className={css`
                  font-size: 0.875rem;
                  color: var(--color-gray-600);
                `}
              >
                {t("label-email-subject")}
              </div>
              <div
                className={css`
                  font-weight: 600;
                  overflow-wrap: anywhere;
                `}
              >
                {preview.subject}
              </div>
            </div>
            <div
              className={css`
                display: flex;
                flex-wrap: wrap;
                gap: 1rem 2rem;
              `}
            >
              <RadioGroup
                name="view"
                control={control}
                variant="segmented"
                label={t("email-preview-version")}
              >
                <Radio value={VIEW_HTML} label={t("email-preview-html")} />
                <Radio value={VIEW_PLAIN_TEXT} label={t("email-preview-plain-text")} />
              </RadioGroup>
              {view === VIEW_HTML && (
                <RadioGroup
                  name="width"
                  control={control}
                  variant="segmented"
                  label={t("email-preview-width")}
                >
                  <Radio value={WIDTH_DESKTOP} label={t("email-preview-desktop")} />
                  <Radio value={WIDTH_MOBILE} label={t("email-preview-mobile")} />
                </RadioGroup>
              )}
            </div>
            {view === VIEW_HTML ? (
              <iframe
                title={t("email-preview")}
                // An empty sandbox: the email runs no scripts and gets an opaque origin.
                sandbox=""
                srcDoc={preview.html}
                className={css`
                  display: block;
                  width: ${width === WIDTH_MOBILE ? `${MOBILE_WIDTH_PX}px` : "100%"};
                  max-width: 100%;
                  height: 60vh;
                  margin: 0 auto;
                  border: 1px solid var(--color-gray-300);
                  border-radius: 4px;
                `}
              />
            ) : (
              <pre
                className={css`
                  margin: 0;
                  padding: 1rem;
                  max-height: 60vh;
                  overflow: auto;
                  white-space: pre-wrap;
                  overflow-wrap: anywhere;
                  background: var(--color-gray-50);
                  border: 1px solid var(--color-gray-300);
                  border-radius: 4px;
                `}
              >
                {preview.plain_text}
              </pre>
            )}
          </>
        )}
        <p
          className={css`
            margin: 0;
            font-size: 0.875rem;
            color: var(--color-gray-600);
          `}
        >
          {t("send-test-email-explanation")}
        </p>
        {sendTestMutation.isSuccess && (
          <Infobox tone={TONE.SUCCESS} announce>
            {t("test-email-queued")}
          </Infobox>
        )}
        {sendTestMutation.isError && (
          <Infobox tone={TONE.DANGER} heading={t("test-email-failed")} announce>
            {getErrorMessage(sendTestMutation.error)}
          </Infobox>
        )}
      </div>
    </Dialog>
  )
}

export default EmailPreviewDialog
