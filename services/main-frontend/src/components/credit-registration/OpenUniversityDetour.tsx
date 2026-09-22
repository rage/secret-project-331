"use client"

import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { Trans, useTranslation } from "react-i18next"

import { Button, Infobox, Radio, RadioGroup, TransLink } from "@/shared-module/components"
import { questionLegendCss } from "@/shared-module/components/components/RadioGroup"

import { CertificateHandoff } from "./CertificateHandoff"
import {
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  SEGMENTED,
  SUOMI_FI_EIDAS_URL,
  SUOMI_FI_IDENTIFICATION_URL,
  TONE,
} from "./constants"
import { CreditJustificationForm } from "./CreditJustificationForm"
import { bandCss, rowCss } from "./styles"

const HAS_FINNISH_ID_FIELD = "hasFinnishId"
const NEED_FIELD = "need"
const IDENTIFICATION_FIELD = "identification"
const NEED_AFTER_RECONSIDER_FIELD = "needAfterReconsider"

const YES = "yes"
const NO = "no"
const CERTIFICATE = "certificate"
const CREDITS = "credits"
const EIDAS = "eidas"
const OTHER_SUOMI_FI = "other_suomi_fi"
const NO_SUOMI_FI = "none"

interface DetourForm {
  [HAS_FINNISH_ID_FIELD]: string
  [NEED_FIELD]: string
  [IDENTIFICATION_FIELD]: string
  [NEED_AFTER_RECONSIDER_FIELD]: string
}

export interface OpenUniversityDetourProps {
  courseModuleId: string
  /** The certificate the student can generate now; having one is what makes the detour worth asking. */
  certificateConfigurationId: string
  /** What the student wrote the last time they answered the last question, if they did. */
  creditJustification: string | null | undefined
  /** The Open University instructions every route through the detour ends at. */
  openUniversityContent: React.ReactNode
}

/**
 * The questions between "I am not a University of Helsinki student" and the Open University
 * instructions, for a module whose certificate would serve many of the students who land here.
 *
 * Registering credits means enrolling, enrolling means strong authentication, and a student
 * without a Finnish personal identity code or a Suomi.fi method pays for that in weeks of manual
 * identity checking. Every question exists to find the student a certificate serves instead, and
 * every one of them stays answerable: a changed answer only hides what is under it.
 */
export const OpenUniversityDetour: React.FC<OpenUniversityDetourProps> = ({
  courseModuleId,
  certificateConfigurationId,
  creditJustification,
  openUniversityContent,
}) => {
  // Default namespace, like the registration page these bands belong to, not the
  // `credit-registration` one the rest of this folder reads.
  const { t } = useTranslation()
  const { control, watch, setValue } = useForm<DetourForm>({
    defaultValues: {
      [HAS_FINNISH_ID_FIELD]: "",
      [NEED_FIELD]: "",
      [IDENTIFICATION_FIELD]: "",
      [NEED_AFTER_RECONSIDER_FIELD]: "",
    },
  })
  const [justificationSaved, setJustificationSaved] = useState(false)
  const identificationHeadingId = React.useId()

  const hasFinnishId = watch(HAS_FINNISH_ID_FIELD)
  const need = watch(NEED_FIELD)
  const identification = watch(IDENTIFICATION_FIELD)
  const needAfterReconsider = watch(NEED_AFTER_RECONSIDER_FIELD)

  // Each band is conditioned on the one above it having led here, not on its own answer alone.
  // Answers survive an upstream change so a student who flips back finds their place, and without
  // the chain a stale answer would open a band under a branch that no longer reaches it.
  const asksWhichIsNeeded = hasFinnishId === NO
  const asksHowTheyIdentify = asksWhichIsNeeded && need === CREDITS
  const identifiesWithEidas = asksHowTheyIdentify && identification === EIDAS
  const identifiesWithAnotherSuomiFiMethod =
    asksHowTheyIdentify && identification === OTHER_SUOMI_FI
  const asksToReconsider = asksHowTheyIdentify && identification === NO_SUOMI_FI
  const asksWhyCreditsAreNeeded = asksToReconsider && needAfterReconsider === CREDITS
  const takesTheCertificate =
    (asksWhichIsNeeded && need === CERTIFICATE) ||
    (asksToReconsider && needAfterReconsider === CERTIFICATE)
  const justificationIsStored = justificationSaved || Boolean(creditJustification)
  const showsOpenUniversityContent =
    hasFinnishId === YES ||
    identifiesWithEidas ||
    identifiesWithAnotherSuomiFiMethod ||
    (asksWhyCreditsAreNeeded && justificationIsStored)

  return (
    <>
      <section className={bandCss}>
        <RadioGroup
          name={HAS_FINNISH_ID_FIELD}
          control={control}
          variant={SEGMENTED}
          label={t("are-you-finnish-or-do-you-have-a-finnish-personal-identity-code")}
        >
          <Radio value={YES} label={t("yes")} />
          <Radio value={NO} label={t("no")} />
        </RadioGroup>
      </section>

      {asksWhichIsNeeded ? (
        <section className={bandCss}>
          <RadioGroup
            name={NEED_FIELD}
            control={control}
            variant={SEGMENTED}
            fillWidth
            label={t("which-do-you-need")}
            description={t("credits-in-uh-registry-are-useful-mainly-if-you-study-in-finland")}
          >
            <Radio value={CERTIFICATE} label={t("a-certificate-of-completion")} />
            <Radio value={CREDITS} label={t("credits-in-the-uh-study-registry")} />
          </RadioGroup>
        </section>
      ) : null}

      {asksHowTheyIdentify ? (
        <section className={bandCss}>
          <h2 id={identificationHeadingId} className={questionLegendCss}>
            {t("how-will-you-identify-yourself")}
          </h2>
          <p>{t("enrollment-requires-strong-authentication-choose-how-you-identify")}</p>
          <p>
            <Trans
              t={t}
              i18nKey="eidas-explanation"
              components={{
                eidasLink: (
                  <TransLink href={SUOMI_FI_EIDAS_URL} target="_blank" rel="noopener noreferrer" />
                ),
              }}
            />
          </p>
          <p>
            <Trans
              t={t}
              i18nKey="other-suomi-fi-identification-methods-explanation"
              components={{
                suomiFiLink: (
                  <TransLink
                    href={SUOMI_FI_IDENTIFICATION_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                ),
              }}
            />
          </p>
          {/* Plain buttons, not radio inputs, so the selected one has to say so itself — the
              toggle-button `aria-pressed` pattern, not a radio's native checked state. */}
          <div role="group" aria-labelledby={identificationHeadingId} className={rowCss}>
            <Button
              variant={identification === EIDAS ? BUTTON_PRIMARY : BUTTON_SECONDARY}
              domProps={{ "aria-pressed": identification === EIDAS }}
              onClick={() => setValue(IDENTIFICATION_FIELD, EIDAS)}
            >
              {t("eidas")}
            </Button>
            <Button
              variant={identification === OTHER_SUOMI_FI ? BUTTON_PRIMARY : BUTTON_SECONDARY}
              domProps={{ "aria-pressed": identification === OTHER_SUOMI_FI }}
              onClick={() => setValue(IDENTIFICATION_FIELD, OTHER_SUOMI_FI)}
            >
              {t("another-suomi-fi-identification-method")}
            </Button>
            <Button
              variant={identification === NO_SUOMI_FI ? BUTTON_PRIMARY : BUTTON_SECONDARY}
              domProps={{ "aria-pressed": identification === NO_SUOMI_FI }}
              onClick={() => setValue(IDENTIFICATION_FIELD, NO_SUOMI_FI)}
            >
              {t("no")}
            </Button>
          </div>
        </section>
      ) : null}

      {identifiesWithEidas ? (
        <section className={bandCss}>
          <Infobox tone={TONE.INFO}>
            {t("tip-in-sisu-choose-suomi-fi-e-identification-then-eidas")}
          </Infobox>
        </section>
      ) : null}

      {identifiesWithAnotherSuomiFiMethod ? (
        <section className={bandCss}>
          <Infobox tone={TONE.INFO}>
            {t("tip-in-sisu-choose-suomi-fi-e-identification-then-your-method")}
          </Infobox>
        </section>
      ) : null}

      {asksToReconsider ? (
        <section className={bandCss}>
          <RadioGroup
            name={NEED_AFTER_RECONSIDER_FIELD}
            control={control}
            variant={SEGMENTED}
            fillWidth
            label={t("reconsider-which-do-you-need")}
            description={t("without-suomi-fi-identification-we-verify-your-identity-manually")}
          >
            <Radio value={CERTIFICATE} label={t("a-certificate-of-completion")} />
            <Radio value={CREDITS} label={t("credits-in-the-uh-study-registry")} />
          </RadioGroup>
        </section>
      ) : null}

      {takesTheCertificate ? (
        <CertificateHandoff
          courseModuleId={courseModuleId}
          certificateConfigurationId={certificateConfigurationId}
        />
      ) : null}

      {asksWhyCreditsAreNeeded ? (
        <CreditJustificationForm
          courseModuleId={courseModuleId}
          savedJustification={creditJustification}
          onSaved={() => {
            setJustificationSaved(true)
          }}
        />
      ) : null}

      {showsOpenUniversityContent ? openUniversityContent : null}
    </>
  )
}
