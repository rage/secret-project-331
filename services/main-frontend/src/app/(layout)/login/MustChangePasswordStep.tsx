"use client"

import { css, cx } from "@emotion/css"
import { CheckCircle, Padlock, PaperAirplane } from "@vectopus/atlas-icons-react"
import i18n from "i18next"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { sendResetPasswordEmail } from "@/generated/api/sdk.generated"
import useQueryParameter from "@/shared-module/common/hooks/useQueryParameter"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { baseTheme } from "@/shared-module/common/styles"
import { isBoolean } from "@/shared-module/common/utils/fetching"
import { validateReturnToRouteOrDefault } from "@/shared-module/common/utils/redirectBackAfterLoginOrSignup"
import { Button, ErrorNotice, Link } from "@/shared-module/components"
import { validateGeneratedData } from "@/utils/validateGeneratedData"

interface MustChangePasswordStepProps {
  email: string
  onBack: () => void
}

const stepContainerCss = css`
  display: flex;
  flex-direction: column;
  padding: 3rem 0;
  max-width: 32rem;
  gap: 1.25rem;
`

const headingRowCss = css`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`

const sentHeadingRowCss = cx(
  headingRowCss,
  css`
    color: ${baseTheme.colors.green[600]};
  `,
)

const pendingHeadingRowCss = cx(
  headingRowCss,
  css`
    color: ${baseTheme.colors.blue[600]};
  `,
)

const headingCss = css`
  margin: 0;
  font-size: 1.5rem;
`

const descriptionCss = css`
  margin: 0;
  color: ${baseTheme.colors.gray[700]};
  line-height: 1.5;
`

const emailCss = css`
  padding: 0.75rem 1rem;
  border-radius: 6px;
  background: ${baseTheme.colors.gray[100]};
  color: ${baseTheme.colors.gray[600]};
  font-size: 0.95rem;
`

const actionsCss = css`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1rem;
`

/** Login step for accounts without a stored password: offers a password reset email instead. */
export const MustChangePasswordStep: React.FC<MustChangePasswordStepProps> = ({
  email,
  onBack,
}) => {
  const { t } = useTranslation()
  const uncheckedReturnTo = useQueryParameter("return_to")
  const [emailSent, setEmailSent] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)

  // The button that led here unmounts, so move focus to the new view's heading.
  useEffect(() => {
    headingRef.current?.focus()
  }, [emailSent])

  const sendMutation = useToastMutation(
    async () =>
      validateGeneratedData(
        await sendResetPasswordEmail({ body: { email, language: i18n.language } }),
        isBoolean,
      ),
    { method: "POST", notify: true },
    {
      onSuccess: () => setEmailSent(true),
    },
  )

  const returnTo = validateReturnToRouteOrDefault(uncheckedReturnTo, "/")
  // oxlint-disable-next-line i18next/no-literal-string -- route path and query key
  const resetPasswordHref = `/reset-password?return_to=${encodeURIComponent(returnTo)}`

  if (emailSent) {
    return (
      <div className={stepContainerCss}>
        <div className={sentHeadingRowCss}>
          <CheckCircle aria-hidden size={28} />
          <h1 ref={headingRef} tabIndex={-1} className={headingCss}>
            {t("password-reset-email-sent")}
          </h1>
        </div>
        <p className={descriptionCss}>{t("password-reset-email-sent-description", { email })}</p>
        <Button variant="primary" size="medium" type="button" onPress={onBack}>
          {t("must-change-password-back-to-login")}
        </Button>
      </div>
    )
  }

  return (
    <div className={stepContainerCss}>
      <div className={pendingHeadingRowCss}>
        <Padlock aria-hidden size={28} />
        <h1 ref={headingRef} tabIndex={-1} className={headingCss}>
          {t("must-change-password-title")}
        </h1>
      </div>
      <p className={descriptionCss}>{t("must-change-password-description")}</p>
      <div className={emailCss}>{email}</div>
      {/* notify:true already announces this error via the toast; the notice is the persistent copy */}
      {sendMutation.isError && (
        // oxlint-disable-next-line i18next/no-literal-string -- "off" is an ErrorNoticeAnnouncement enum value, not UI text
        <ErrorNotice error={sendMutation.error} announce="off" />
      )}
      <div className={actionsCss}>
        <Button
          variant="primary"
          size="medium"
          type="button"
          icon={<PaperAirplane aria-hidden size={18} />}
          isLoading={sendMutation.isPending}
          onPress={() => sendMutation.mutate()}
        >
          {t("must-change-password-send-reset-email")}
        </Button>
        <Button variant="tertiary" size="medium" type="button" onPress={onBack}>
          {t("must-change-password-back-to-login")}
        </Button>
        <Link href={resetPasswordHref}>{t("must-change-password-open-reset-page")}</Link>
      </div>
    </div>
  )
}
