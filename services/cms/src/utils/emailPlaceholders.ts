import type { BlockInstance } from "@/utils/Gutenberg/types"

export const PLACEHOLDER_RESET_LINK = "RESET_LINK"
export const PLACEHOLDER_CODE = "CODE"
export const PLACEHOLDER_LINK = "LINK"
export const PLACEHOLDER_NAME = "NAME"
export const PLACEHOLDER_STUDENT_NUMBER = "STUDENT_NUMBER"
export const PLACEHOLDER_COURSE_NAME = "COURSE_NAME"
export const PLACEHOLDER_MODULE_NAME = "MODULE_NAME"
export const PLACEHOLDER_CREDITS = "CREDITS"
export const PLACEHOLDER_STATUS_LINK = "STATUS_LINK"

export interface PlaceholderConfig {
  required: string[]
  available: string[]
}

const CREDIT_REGISTRATION_NOTIFICATION_PLACEHOLDERS = [
  PLACEHOLDER_NAME,
  PLACEHOLDER_COURSE_NAME,
  PLACEHOLDER_MODULE_NAME,
  PLACEHOLDER_CREDITS,
  PLACEHOLDER_STATUS_LINK,
]

/**
 * Must match what headless-lms fills in: `email_deliver.rs` for account-based templates, and the
 * placeholder bags in credit-registration's `link_emails.rs` and `student_notifications.rs`.
 */
export const TEMPLATE_PLACEHOLDER_CONFIG: Record<string, PlaceholderConfig> = {
  reset_password_email: {
    required: [PLACEHOLDER_RESET_LINK],
    available: [PLACEHOLDER_RESET_LINK],
  },
  delete_user_email: {
    required: [PLACEHOLDER_CODE],
    available: [PLACEHOLDER_CODE],
  },
  confirm_email_code: {
    required: [PLACEHOLDER_CODE],
    available: [PLACEHOLDER_CODE],
  },
  verify_email_address: {
    required: [PLACEHOLDER_CODE],
    available: [PLACEHOLDER_CODE],
  },
  credit_registration_account_linking: {
    required: [PLACEHOLDER_LINK],
    available: [
      PLACEHOLDER_LINK,
      PLACEHOLDER_NAME,
      PLACEHOLDER_STUDENT_NUMBER,
      PLACEHOLDER_COURSE_NAME,
    ],
  },
  credit_registration_action_needed: {
    required: [PLACEHOLDER_STATUS_LINK],
    available: CREDIT_REGISTRATION_NOTIFICATION_PLACEHOLDERS,
  },
  credit_registration_registered: {
    required: [],
    available: CREDIT_REGISTRATION_NOTIFICATION_PLACEHOLDERS,
  },
}

export interface PlaceholderValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  detectedPlaceholders: string[]
  missingRequired: string[]
  invalidPlaceholders: string[]
}

/** Placeholder keys used in the body or the subject, which the sender fills in both. */
export function extractPlaceholders(blocks: BlockInstance[], subject: string): string[] {
  const placeholders = new Set<string>()
  const placeholderRegex = /\{\{(\w+)\}\}/g

  // Every attribute, not just paragraph text: the sender fills placeholders anywhere, e.g. a button URL.
  function extractFromValue(value: unknown) {
    if (typeof value === "string") {
      for (const match of value.matchAll(placeholderRegex)) {
        const captured = match[1]
        if (captured !== undefined) {
          placeholders.add(captured)
        }
      }
    } else if (Array.isArray(value)) {
      value.forEach((element) => extractFromValue(element))
    } else if (value !== null && typeof value === "object") {
      Object.values(value).forEach((field) => extractFromValue(field))
    }
  }

  function extractFromBlock(block: BlockInstance) {
    extractFromValue(block.attributes)
    block.innerBlocks?.forEach((innerBlock) => extractFromBlock(innerBlock))
  }

  blocks.forEach((block) => extractFromBlock(block))
  extractFromValue(subject)
  return Array.from(placeholders)
}

export function validatePlaceholders(
  templateName: string,
  foundPlaceholders: string[],
): PlaceholderValidationResult {
  const config = TEMPLATE_PLACEHOLDER_CONFIG[templateName.toLowerCase()]
  const errors: string[] = []
  const warnings: string[] = []
  const detectedPlaceholders = [...foundPlaceholders]
  const missingRequired: string[] = []
  const invalidPlaceholders: string[] = []

  if (!config) {
    if (foundPlaceholders.length > 0) {
      warnings.push(
        `Template "${templateName}" does not support placeholders, but ${foundPlaceholders.length} placeholder(s) were found.`,
      )
      invalidPlaceholders.push(...foundPlaceholders)
    }
    return {
      valid: true,
      errors,
      warnings,
      detectedPlaceholders,
      missingRequired,
      invalidPlaceholders,
    }
  }

  const availableSet = new Set(config.available)
  const foundSet = new Set(foundPlaceholders)

  config.required.forEach((required) => {
    if (!foundSet.has(required)) {
      missingRequired.push(required)
      errors.push(`Required placeholder "{{${required}}}" is missing.`)
    }
  })

  foundPlaceholders.forEach((placeholder) => {
    if (!availableSet.has(placeholder)) {
      invalidPlaceholders.push(placeholder)
      warnings.push(`Unknown placeholder "{{${placeholder}}}" found. It will not be replaced.`)
    }
  })

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    detectedPlaceholders,
    missingRequired,
    invalidPlaceholders,
  }
}

export function getPlaceholderConfig(templateName: string): PlaceholderConfig | null {
  return TEMPLATE_PLACEHOLDER_CONFIG[templateName.toLowerCase()] || null
}
