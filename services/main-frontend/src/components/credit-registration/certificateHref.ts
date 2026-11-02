import type { CertificateOffer } from "./creditRegistrationSubject"

const GENERATE_CERTIFICATE_PATH = "/generate-certificate"

/** The page where the student generates the offered certificate. */
export const certificateHref = (certificate: CertificateOffer): string =>
  `${GENERATE_CERTIFICATE_PATH}?module=${certificate.courseModuleId}&ccid=${certificate.certificateConfigurationId}`
