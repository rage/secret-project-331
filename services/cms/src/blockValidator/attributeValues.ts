/* oxlint-disable i18next/no-literal-string */

import { memoize } from "lodash"

import { renderErrorForSpec } from "@/blocks/Chart/validateChartSpec"
import type { AttributeSchema, JsonType, RichTextFormat } from "@/utils/Gutenberg/agentSchema"

import { isSafeUrl, normaliseRichText } from "./richText"

export type AttributePath = (string | number)[]

export interface AttributeIssue {
  path: AttributePath
  code: "invalid_attribute" | "disallowed_markup"
  message: string
  fix: string
}

export interface CheckedValue {
  value: unknown
  issues: AttributeIssue[]
}

const describe = (value: unknown): string => {
  if (value === null) {
    return "null"
  }
  if (Array.isArray(value)) {
    return "an array"
  }
  return typeof value === "object" ? "an object" : `${typeof value} ${JSON.stringify(value)}`
}

/** A JSON object: not null, an array or a class instance. */
export const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype

const matchesType = (type: JsonType, value: unknown): boolean => {
  switch (type) {
    case "string":
      return typeof value === "string"
    case "number":
      return typeof value === "number" && Number.isFinite(value)
    case "integer":
      return Number.isInteger(value)
    case "boolean":
      return typeof value === "boolean"
    case "null":
      return value === null
    case "array":
      return Array.isArray(value)
    case "object":
      return isPlainObject(value)
  }
}

const issue = (path: AttributePath, message: string, fix: string): AttributeIssue => ({
  path,
  code: "invalid_attribute",
  message,
  fix,
})

const reject = (
  value: unknown,
  path: AttributePath,
  message: string,
  fix: string,
): CheckedValue => ({ value, issues: [issue(path, message, fix)] })

/** The attribute path as an agent writes it, such as `body[0].cells`; built only for errors. */
const pathName = (path: AttributePath): string =>
  path
    .slice(1)
    .map((part, index) =>
      typeof part === "number" ? `[${part}]` : index === 0 ? part : `.${part}`,
    )
    .join("")

const compiledPattern = memoize((pattern: string) => new RegExp(pattern))

const formatSet = memoize(
  (formats: readonly RichTextFormat[]): ReadonlySet<RichTextFormat> => new Set(formats),
)

/**
 * Checks a value against an attribute schema and returns it as the editor would store it. The path
 * starts with "attributes" so it can go into an error as is.
 */
export const checkAttributeValue = (
  schema: AttributeSchema,
  value: unknown,
  path: AttributePath,
): CheckedValue => {
  const types = schema.type === undefined ? [] : [schema.type].flat()
  if (types.length > 0 && !types.some((type) => matchesType(type, value))) {
    const name = pathName(path)
    const expected = types.join(" or ")
    return reject(
      value,
      path,
      `${name} is ${describe(value)}, expected ${expected}.`,
      value === null && typeof path.at(-1) === "string"
        ? `Leave ${name} out to use its default, or set it to a ${expected}.`
        : `Set ${name} to a ${expected}.`,
    )
  }
  if (schema.enum && !schema.enum.some((allowed) => allowed === value)) {
    return reject(
      value,
      path,
      `${pathName(path)} is ${describe(value)}, which isn't one of the allowed values.`,
      `Use one of ${schema.enum.map((allowed) => JSON.stringify(allowed)).join(", ")}.`,
    )
  }

  if (typeof value === "string") {
    return checkString(schema, value, path)
  }
  if (typeof value === "number") {
    if (
      (schema.minimum !== undefined && value < schema.minimum) ||
      (schema.maximum !== undefined && value > schema.maximum)
    ) {
      return reject(
        value,
        path,
        `${pathName(path)} is ${value}, outside ${schema.minimum ?? "-∞"}…${schema.maximum ?? "∞"}.`,
        `Use a value from ${schema.minimum ?? "-∞"} to ${schema.maximum ?? "∞"}.`,
      )
    }
    return { value, issues: [] }
  }
  if (Array.isArray(value)) {
    return checkArray(schema, value, path)
  }
  if (isPlainObject(value)) {
    return checkObject(schema, value, path)
  }
  return { value, issues: [] }
}

const checkString = (schema: AttributeSchema, value: string, path: AttributePath): CheckedValue => {
  if (schema.pattern !== undefined && !compiledPattern(schema.pattern).test(value)) {
    return reject(
      value,
      path,
      `${pathName(path)} ${JSON.stringify(value)} isn't in the accepted form.`,
      `Match ${schema.pattern}.`,
    )
  }
  if (schema.format === "uri-reference" && !isSafeUrl(value)) {
    return reject(
      value,
      path,
      `${pathName(path)} ${JSON.stringify(value)} isn't an http(s), mailto, tel or relative URL.`,
      "Use an https:// URL or a path on this site.",
    )
  }
  if (schema["x-vega-lite-spec"] && value !== "") {
    const renderError = renderErrorForSpec(value)
    if (renderError !== null) {
      return reject(
        value,
        path,
        `${pathName(path)} doesn't render: ${renderError}`,
        "Give a Vega-Lite JSON specification that compiles.",
      )
    }
  }
  if (schema["x-rich-text"]) {
    const result = normaliseRichText(value, formatSet(schema["x-rich-text-formats"] ?? []))
    if (!result.isValid) {
      const name = pathName(path)
      return {
        value,
        issues: result.problems.map((problem) => ({
          path,
          code: "disallowed_markup",
          message: `${name}: ${problem.message}`,
          fix: problem.fix,
        })),
      }
    }
    return { value: result.html, issues: [] }
  }
  return { value, issues: [] }
}

const checkArray = (
  schema: AttributeSchema,
  value: unknown[],
  path: AttributePath,
): CheckedValue => {
  if (schema.maxItems !== undefined && value.length > schema.maxItems) {
    const name = pathName(path)
    return reject(
      value,
      path,
      schema.maxItems === 0
        ? `${name} has no item schema agents may write.`
        : `${name} has more than ${schema.maxItems} items.`,
      schema.maxItems === 0 ? `Set ${name} to [].` : `Keep at most ${schema.maxItems} items.`,
    )
  }
  const itemSchema = schema.items
  if (!itemSchema) {
    return { value, issues: [] }
  }
  const checked = value.map((item, index) =>
    checkAttributeValue(itemSchema, item, [...path, index]),
  )
  return {
    value: checked.map((item) => item.value),
    issues: checked.flatMap((item) => item.issues),
  }
}

const checkObject = (
  schema: AttributeSchema,
  value: Record<string, unknown>,
  path: AttributePath,
): CheckedValue => {
  if (schema.maxProperties !== undefined && Object.keys(value).length > schema.maxProperties) {
    const name = pathName(path)
    return reject(
      value,
      path,
      `${name} is a free-form object, which isn't accepted.`,
      `Set ${name} to {} or leave it out.`,
    )
  }
  const properties = schema.properties
  if (!properties) {
    return { value, issues: [] }
  }
  const issues: AttributeIssue[] = []
  if (schema.additionalProperties === false) {
    for (const key of Object.keys(value)) {
      if (!Object.hasOwn(properties, key)) {
        const name = pathName(path)
        issues.push(
          issue(
            [...path, key],
            `${name} has an unknown key ${JSON.stringify(key)}.`,
            `Remove it; ${name} accepts ${Object.keys(properties).join(", ")}.`,
          ),
        )
      }
    }
  }
  for (const key of schema.required ?? []) {
    if (!Object.hasOwn(value, key)) {
      issues.push(issue([...path, key], `${pathName(path)} is missing ${key}.`, `Add ${key}.`))
    }
  }
  const normalised: Record<string, unknown> = {}
  for (const [key, propertySchema] of Object.entries(properties)) {
    if (Object.hasOwn(value, key)) {
      const checked = checkAttributeValue(propertySchema, value[key], [...path, key])
      normalised[key] = checked.value
      issues.push(...checked.issues)
    } else if (propertySchema.default !== undefined) {
      normalised[key] = structuredClone(propertySchema.default)
    }
  }
  return { value: issues.length > 0 ? value : normalised, issues }
}
