"use client"

import { css } from "@emotion/css"
import { useQueryClient } from "@tanstack/react-query"
import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { getCourseModuleUserCompletionQueryKey } from "@/generated/api/@tanstack/react-query.generated"
import { setMyCreditJustification } from "@/generated/api/sdk.generated"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { Button, Infobox, TextArea } from "@/shared-module/components"

import { BUTTON_PRIMARY, TONE } from "./constants"
import { bandCss, headingCss, rowCss } from "./styles"

const JUSTIFICATION_FIELD = "justification"
const JUSTIFICATION_ROWS = 4
/** The server's own cap, so the field stops accepting text instead of letting the save fail on it. */
const JUSTIFICATION_MAX_LENGTH = 4000

const formCss = css`
  display: grid;
  gap: var(--space-4);
`

interface JustificationForm {
  [JUSTIFICATION_FIELD]: string
}

export interface CreditJustificationFormProps {
  courseModuleId: string
  /** What the student wrote the last time they got this far, if they did. */
  savedJustification: string | null | undefined
  onSaved: () => void
}

/**
 * The last question before the Open University instructions, for the student who wants the credits
 * even though identifying themselves will take a manual check.
 *
 * Answering is what opens the instructions, so the answer has to be saved before they are shown;
 * the answer itself is advisory and nothing waits on it.
 */
export const CreditJustificationForm: React.FC<CreditJustificationFormProps> = ({
  courseModuleId,
  savedJustification,
  onSaved,
}) => {
  // Default namespace, like the registration page this band belongs to, not the
  // `credit-registration` one the rest of this folder reads.
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { control, handleSubmit } = useForm<JustificationForm>({
    defaultValues: { [JUSTIFICATION_FIELD]: savedJustification ?? "" },
  })

  const save = useToastMutation<void, unknown, string>(
    async (justification) => {
      await setMyCreditJustification({
        path: { course_module_id: courseModuleId },
        body: { justification },
      })
    },
    { notify: false },
    {
      onSuccess: async () => {
        onSaved()
        await queryClient.invalidateQueries({
          queryKey: getCourseModuleUserCompletionQueryKey({
            path: { course_module_id: courseModuleId },
          }),
        })
      },
    },
  )

  // A saved reason from an earlier visit means the flow already continued past this band, so
  // relabel the button: "Continue" would claim there is still somewhere to go from here.
  const hasSavedAnswer = Boolean(savedJustification) || save.isSuccess

  return (
    <section className={bandCss}>
      <h2 className={headingCss}>{t("heading-tell-us-why-you-need-the-credits")}</h2>
      <p>{t("tell-us-why-you-need-the-credits-instead-of-a-certificate")}</p>
      {/* The mutation does not toast, so without this a failed save looks like a button that did
          nothing. `announce` makes it an alert (assertive), not just news the reveal region would
          otherwise get to on its own time — a failed submit is the one thing here worth interrupting. */}
      {save.isError ? (
        <Infobox tone={TONE.DANGER} announce>
          {t("credit-justification-save-failed")}
        </Infobox>
      ) : null}
      <form
        className={formCss}
        onSubmit={handleSubmit((values) => {
          save.mutate(values[JUSTIFICATION_FIELD].trim())
        })}
      >
        <TextArea
          name={JUSTIFICATION_FIELD}
          control={control}
          label={t("label-your-reason")}
          rows={JUSTIFICATION_ROWS}
          maxLength={JUSTIFICATION_MAX_LENGTH}
          isRequired
          rules={{
            validate: (value: string) =>
              value.trim().length > 0 || t("tell-us-briefly-why-you-need-the-credits"),
          }}
        />
        {/* Enabled while the field is empty on purpose: a greyed-out button leaves the student
            with nothing to read about why it is greyed out. */}
        <div className={rowCss}>
          <Button type="submit" variant={BUTTON_PRIMARY} size="medium" isLoading={save.isPending}>
            {hasSavedAnswer ? t("update-reason") : t("continue")}
          </Button>
        </div>
      </form>
      {save.isSuccess ? (
        <Infobox tone={TONE.SUCCESS} announce>
          {t("your-answer-has-been-saved")}
        </Infobox>
      ) : null}
    </section>
  )
}
