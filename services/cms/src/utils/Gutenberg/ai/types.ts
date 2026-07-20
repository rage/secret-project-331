export interface JSONSchemaObject {
  type: string
  properties?: Record<string, unknown>
  required?: string[]
}

export interface AbilityDefinition<I = unknown, O = unknown> {
  name: string
  label: string
  description: string
  category: string
  input_schema: JSONSchemaObject
  output_schema: JSONSchemaObject
  callback: (input: I) => Promise<O>
}

export interface AbilityCategory {
  label: string
  description?: string
}
