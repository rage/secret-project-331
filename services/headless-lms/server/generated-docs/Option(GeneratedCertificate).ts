type Option<GeneratedCertificate> = {
  id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  user_id: string
  name_on_certificate: string
  verification_id: string
  certificate_configuration_id: string
} | null
