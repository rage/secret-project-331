"use client"

import { Item } from "@react-stately/collections"
import { type TabListState, useTabListState } from "@react-stately/tabs"

import { omitUndefined } from "@/shared-module/common/utils/nullability"

interface TabListItem {
  key: string
  title: string
}

/**
 * Tab list state whose `selectedKey` tab is focusable, so Tab lands on it and the arrow keys move
 * between tabs. Selection only drives focus; the tabs themselves navigate.
 */
export function useFocusableTabListState(
  items: TabListItem[],
  selectedKey: string | undefined,
): TabListState<object> {
  return useTabListState<TabListItem>({
    ...omitUndefined({ selectedKey }),
    ...omitUndefined({ defaultSelectedKey: items[0]?.key }),
    items,
    // Without a collection the selection manager knows no keys, so it can never focus the selected
    // tab and every tab stays at tabindex -1.
    children: (item) => (
      <Item key={item.key} textValue={item.title}>
        {item.title}
      </Item>
    ),
  }) as TabListState<object>
}
