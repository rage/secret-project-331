import { useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"

import { certificateHref } from "./certificateHref"
import {
  type CertificateOffer,
  goToMoocfiCertificate,
  type MoocfiCertificateOffer,
} from "./creditRegistrationSubject"

/**
 * Takes the student to the offered certificate: a page here for a module, mooc.fi's certificate
 * page for a mooc.fi completion. Only the mooc.fi handoff can fail, which `isError` reports.
 */
export const useGoToCertificate = (certificate: CertificateOffer | null) => {
  const router = useRouter()
  const { i18n } = useTranslation()
  const handoff = useMutation({
    mutationFn: (offer: MoocfiCertificateOffer) => goToMoocfiCertificate(offer, i18n.language),
  })
  const goToCertificate = async () => {
    if (certificate?.kind === "course_module") {
      router.push(certificateHref(certificate))
    } else if (certificate?.kind === "mooc_fi") {
      await handoff.mutateAsync(certificate).catch(() => undefined)
    }
  }
  return { goToCertificate, isPending: handoff.isPending, isError: handoff.isError }
}
