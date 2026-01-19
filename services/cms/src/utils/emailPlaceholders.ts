import { BlockInstance } from "@wordpress/blocks"

export const PLACEHOLDER_RESET_LINK = "RESET_LINK"
export const PLACEHOLDER_CODE = "CODE"

export interface PlaceholderConfig {
  required: string[]
  available: string[]
}

export const TEMPLATE_PLACEHOLDER_CONFIG: Record<string, PlaceholderConfig> = {
  reset_password_email: {
    required: [PLACEHOLDER_RESET_LINK],
    available: [PLACEHOLDER_RESET_LINK],
  },
  delete_user_email: {
    required: [PLACEHOLDER_CODE],
    available: [PLACEHOLDER_CODE],
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

export function extractPlaceholders(blocks: BlockInstance[]): string[] {
  const placeholders = new Set<string>()
  const placeholderRegex = /\{\{(\w+)\}\}/g

  function extractFromBlock(block: BlockInstance) {
    if (block.name === "core/paragraph" && block.attributes?.content) {
      const content = String(block.attributes.content)
      let match
      while ((match = placeholderRegex.exec(content)) !== null) {
        placeholders.add(match[1])
      }
    }

    if (block.innerBlocks) {
      block.innerBlocks.forEach(extractFromBlock)
    }
  }

  blocks.forEach(extractFromBlock)
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
