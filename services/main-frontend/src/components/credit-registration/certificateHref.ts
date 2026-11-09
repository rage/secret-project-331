const GENERATE_CERTIFICATE_PATH = "/generate-certificate"

/** The page where the student generates the certificate of a module. */
export const certificateHref = (
  courseModuleId: string,
  certificateConfigurationId: string,
): string =>
  `${GENERATE_CERTIFICATE_PATH}?module=${courseModuleId}&ccid=${certificateConfigurationId}`
