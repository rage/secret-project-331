"use client"

import { Item, Section } from "@react-stately/collections"
import React from "react"

import { omitUndefined } from "./nullability"

export interface SelectOption {
  value: string
  label: React.ReactNode
  textValue?: string
  isDisabled?: boolean
}

export interface SelectOptionGroup {
  label: React.ReactNode
  options: readonly SelectOption[]
}

export interface NormalizedSelectOption {
  key: string
  value: string
  label: React.ReactNode
  textValue: string
  isDisabled: boolean
  groupKey?: string
  groupLabel?: React.ReactNode
}

export interface NormalizedSelectCollection {
  options: readonly NormalizedSelectOption[]
  disabledKeys: readonly string[]
  valueToKey: Map<string, string>
}

function getNodeTextValue(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") {
    return ""
  }

  if (typeof node === "string" || typeof node === "number") {
    return String(node)
  }

  if (Array.isArray(node)) {
    return node.map((child) => getNodeTextValue(child)).join("")
  }

  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return getNodeTextValue(node.props.children)
  }

  return ""
}

function isSelectOptionGroup(entry: SelectOption | SelectOptionGroup): entry is SelectOptionGroup {
  return "options" in entry
}

export function normalizeSelectOptions(
  entries: readonly (SelectOption | SelectOptionGroup)[],
): NormalizedSelectCollection {
  const options: NormalizedSelectOption[] = []
  const disabledKeys: string[] = []
  const valueToKey = new Map<string, string>()

  const pushOption = (
    option: SelectOption,
    {
      groupKey,
      groupLabel,
    }: {
      groupKey?: string
      groupLabel?: React.ReactNode
    } = {},
  ) => {
    if (valueToKey.has(option.value)) {
      throw new Error(
        `Select options must have unique values. Duplicate value "${option.value}" found.`,
      )
    }

    const normalizedOption: NormalizedSelectOption = {
      key: option.value,
      value: option.value,
      label: option.label,
      textValue: option.textValue ?? getNodeTextValue(option.label),
      isDisabled: Boolean(option.isDisabled),
      ...omitUndefined({ groupKey, groupLabel }),
    }

    valueToKey.set(normalizedOption.value, normalizedOption.key)

    if (normalizedOption.isDisabled) {
      disabledKeys.push(normalizedOption.key)
    }

    options.push(normalizedOption)
  }

  entries.forEach((entry, index) => {
    if (isSelectOptionGroup(entry)) {
      // oxlint-disable-next-line i18next/no-literal-string -- internal collection key
      const groupKey = `group-${index}`
      entry.options.forEach((option) => {
        pushOption(option, {
          groupKey,
          groupLabel: entry.label,
        })
      })
      return
    }

    pushOption(entry)
  })

  return {
    options,
    disabledKeys,
    valueToKey,
  }
}

function buildItem(option: NormalizedSelectOption): React.ReactElement {
  return (
    <Item key={option.key} textValue={option.textValue}>
      {option.label}
    </Item>
  )
}

export function buildSelectCollectionNodes(collection: NormalizedSelectCollection) {
  const orderedNodes: (React.ReactElement | { groupKey: string })[] = []
  const sectionMap = new Map<string, { label: React.ReactNode; items: React.ReactElement[] }>()

  collection.options.forEach((option) => {
    if (!option.groupKey) {
      orderedNodes.push(buildItem(option))
      return
    }

    const existingSection = sectionMap.get(option.groupKey) ?? {
      label: option.groupLabel ?? "",
      items: [],
    }

    if (!sectionMap.has(option.groupKey)) {
      orderedNodes.push({ groupKey: option.groupKey })
    }

    existingSection.items.push(buildItem(option))
    sectionMap.set(option.groupKey, existingSection)
  })

  return orderedNodes
    .map((node) => {
      if (node === null || node === undefined || !("groupKey" in node)) {
        return node
      }

      const section = sectionMap.get(node.groupKey)
      if (!section) {
        return null
      }

      return (
        <Section
          key={node.groupKey}
          aria-label={getNodeTextValue(section.label)}
          title={section.label}
        >
          {section.items as never}
        </Section>
      )
    })
    .filter((node): node is React.ReactElement => node !== null)
}

export function findSelectOptionByValue(
  collection: NormalizedSelectCollection,
  value: string,
): NormalizedSelectOption | undefined {
  return collection.options.find((option) => option.value === value)
}
