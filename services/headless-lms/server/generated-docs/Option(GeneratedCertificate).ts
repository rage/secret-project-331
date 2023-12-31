type Option<GeneratedCertificate> = {
  id: string
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
  user_id: string
  name_on_certificate: string
  verification_id: string
  certificate_configuration_id: string
} | null
