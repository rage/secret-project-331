import { useMemo } from "react"

export enum DialogStep {
  None = "none",
  MissingInfo = "missing-info",
  ChooseInstance = "choose-instance",
  AiUsageNotice = "ai-usage-notice",
  CreditRegistrationConsent = "credit-registration-consent",
  ResearchConsent = "research-consent",
}

export interface DialogStepInputs {
  shouldAnswerMissingInfoForm: boolean
  shouldChooseInstance: boolean
  waitingForCourseSettingsToBeFilled: boolean

  // ai-usage notice related
  shouldShowAiUsageNotice: boolean

  // credit-registration consent related
  shouldAskCreditRegistrationConsent: boolean

  // research-consent related
  researchFormIsLoadedAndExists: boolean
  showResearchConsentFormBecauseOfUrl: boolean
  showResearchConsentFormBecauseOfMissingAnswers: boolean
  hasAnsweredForm: boolean
}

/**
 * Returns exactly one active dialog step based on the required priority:
 * 1) Missing info -> 2) Select course instance -> 3) AI-usage notice ->
 * 4) Credit registration consent -> 5) Research consent
 *
 * Instance choice comes first because it decides which modules exist, the AI notice is a legal
 * must-see, and credit registration matters more to the student than the research form, so it must
 * not sit behind a form people click through.
 */
export default function useDialogStep({
  shouldAnswerMissingInfoForm,
  shouldChooseInstance,
  waitingForCourseSettingsToBeFilled,
  shouldShowAiUsageNotice,
  shouldAskCreditRegistrationConsent,
  researchFormIsLoadedAndExists,
  showResearchConsentFormBecauseOfUrl,
  showResearchConsentFormBecauseOfMissingAnswers,
  hasAnsweredForm,
}: DialogStepInputs): DialogStep {
  const shouldShowResearchConsent =
    researchFormIsLoadedAndExists &&
    (showResearchConsentFormBecauseOfUrl || showResearchConsentFormBecauseOfMissingAnswers) &&
    !hasAnsweredForm

  return useMemo<DialogStep>(() => {
    if (shouldAnswerMissingInfoForm) {
      return DialogStep.MissingInfo
    }
    if (shouldChooseInstance || waitingForCourseSettingsToBeFilled) {
      return DialogStep.ChooseInstance
    }
    if (shouldShowAiUsageNotice) {
      return DialogStep.AiUsageNotice
    }
    if (shouldAskCreditRegistrationConsent) {
      return DialogStep.CreditRegistrationConsent
    }
    if (shouldShowResearchConsent) {
      return DialogStep.ResearchConsent
    }
    return DialogStep.None
  }, [
    shouldAnswerMissingInfoForm,
    shouldChooseInstance,
    waitingForCourseSettingsToBeFilled,
    shouldShowAiUsageNotice,
    shouldAskCreditRegistrationConsent,
    shouldShowResearchConsent,
  ])
}
