import type React from "react"

type ComboBoxKey = string | number

export type ComboBoxItemAccessors<T> = {
  getItemKey: (item: T) => ComboBoxKey
  getItemTextValue: (item: T) => string
  getItemDisabled?: (item: T) => boolean
  renderItem?: (item: T) => React.ReactNode
}

export type NormalizedComboBoxItem<T> = {
  item: T
  key: ComboBoxKey
  rendered: React.ReactNode
  textValue: string
  isDisabled: boolean
}

function getImplicitItemKey<T>(item: T, index: number): ComboBoxKey {
  if (item == null) {
    return index
  }

  if (typeof item === "string" || typeof item === "number") {
    return item
  }

  if (typeof item === "object") {
    if ("key" in item && item.key != null) {
      return item.key as ComboBoxKey
    }

    if ("id" in item && item.id != null) {
      return item.id as ComboBoxKey
    }

    if ("value" in item && item.value != null) {
      return item.value as ComboBoxKey
    }
  }

  return index
}

function getImplicitTextValue<T>(item: T): string {
  if (item == null) {
    return ""
  }

  if (typeof item === "string" || typeof item === "number") {
    return String(item)
  }

  if (typeof item === "object") {
    if ("textValue" in item && typeof item.textValue === "string") {
      return item.textValue
    }

    if ("label" in item && typeof item.label === "string") {
      return item.label
    }

    if ("name" in item && typeof item.name === "string") {
      return item.name
    }

    if ("title" in item && typeof item.title === "string") {
      return item.title
    }

    if ("value" in item && item.value != null) {
      return String(item.value)
    }
  }

  return String(item)
}

export function normalizeComboBoxItems<T>(
  items: Iterable<T>,
  accessors: Partial<ComboBoxItemAccessors<T>> = {},
): NormalizedComboBoxItem<T>[] {
  const normalizedItems = Array.from(items)

  return normalizedItems.map((item, index) => {
    const textValue = accessors.getItemTextValue?.(item) ?? getImplicitTextValue(item)

    return {
      item,
      key: accessors.getItemKey?.(item) ?? getImplicitItemKey(item, index),
      rendered: accessors.renderItem ? accessors.renderItem(item) : textValue,
      textValue,
      isDisabled:
        accessors.getItemDisabled?.(item) ??
        (typeof item === "object" && item != null && "disabled" in item
          ? Boolean(item.disabled)
          : false),
    }
  })
}

export function resolveComboBoxHasValue({
  selectedItem,
  inputValue,
}: {
  selectedItem: unknown
  inputValue: string | undefined
}): boolean {
  if (selectedItem != null) {
    return true
  }

  return typeof inputValue === "string" && inputValue.trim().length > 0
}
