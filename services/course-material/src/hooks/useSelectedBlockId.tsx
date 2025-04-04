import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"

import { courseMaterialBlockClass } from "../utils/constants"

const SELECTED_BLOCK_ID_QUERY_KEY = ["selectedBlockId"]

type BlockIdListener = {
  getCurrentBlockId: () => string | null
  cleanup: () => void
}

const setupBlockIdListener = (): BlockIdListener => {
  let currentBlockId: string | null = document.activeElement?.id ?? null
  const abortController = new AbortController()

  const getState = (): string | null => currentBlockId

  const handleClick = (ev: MouseEvent): void => {
    if (ev.target instanceof Element) {
      let newBlockId = null
      let element: Element | null = ev.target
      while (element !== null) {
        if (element.classList.contains(courseMaterialBlockClass)) {
          newBlockId = element.id
          break
        }
        element = element.parentElement
      }
      currentBlockId = newBlockId
    } else {
      currentBlockId = null
    }
  }

  document.addEventListener("click", handleClick, { signal: abortController.signal })

  return {
    getCurrentBlockId: getState,
    cleanup: () => {
      abortController.abort()
    },
  }
}

let listenerInstance: BlockIdListener | null = null
let observer: MutationObserver | null = null

/**
 * Hook that tracks the currently selected block ID.
 * Uses Tanstack Query to deduplicate event listeners across multiple hook instances.
 *
 * @returns [selectedBlockId, clearSelectedBlock] - The selected block ID and a function to clear it
 */
export default function useSelectedBlockId(): [string | null, () => void] {
  const queryClient = useQueryClient()

  const { data = null } = useQuery({
    queryKey: SELECTED_BLOCK_ID_QUERY_KEY,
    queryFn: (): string | null => {
      if (!listenerInstance) {
        listenerInstance = setupBlockIdListener()

        observer = new MutationObserver(() => {
          queryClient.setQueryData(
            SELECTED_BLOCK_ID_QUERY_KEY,
            listenerInstance?.getCurrentBlockId(),
          )
        })

        observer.observe(document.body, {
          childList: true,
          subtree: true,
        })
      }

      return listenerInstance?.getCurrentBlockId() ?? null
    },
    staleTime: Infinity,
    gcTime: Infinity,
  })

  useEffect(() => {
    return () => {
      if (observer) {
        observer.disconnect()
        observer = null
      }
      if (listenerInstance) {
        listenerInstance.cleanup()
        listenerInstance = null
      }
    }
  }, [])

  const clearSelectedBlock = (): void => {
    queryClient.setQueryData(SELECTED_BLOCK_ID_QUERY_KEY, null)
  }

  return [data, clearSelectedBlock] as [string | null, () => void]
}
