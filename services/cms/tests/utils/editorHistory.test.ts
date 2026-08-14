import type { BlockInstance } from "@/utils/Gutenberg/types"

import {
  canRedoEditorHistory,
  canUndoEditorHistory,
  createEditorHistoryEntry,
  getCurrentEditorHistoryEntry,
  initializeEditorHistory,
  pushEditorHistoryEntry,
  recordEditorHistoryChange,
  redoEditorHistory,
  undoEditorHistory,
  updateCurrentEditorHistoryEntry,
} from "../../src/utils/Gutenberg/editorHistory"

const createParagraphBlock = (clientId: string, content: string): BlockInstance => ({
  name: "core/paragraph",
  clientId,
  isValid: true,
  attributes: {
    content,
  },
  innerBlocks: [],
})

describe("editorHistory", () => {
  it("keeps the state before a typing burst undoable", () => {
    const initialContent = [createParagraphBlock("a", "A")]
    const typedContent = [createParagraphBlock("a", "AB")]

    const typedState = updateCurrentEditorHistoryEntry(
      initializeEditorHistory(initialContent),
      createEditorHistoryEntry(typedContent),
    )

    expect(canUndoEditorHistory(typedState)).toBe(true)
    expect(getCurrentEditorHistoryEntry(typedState)?.content).toBe(typedContent)
    expect(getCurrentEditorHistoryEntry(undoEditorHistory(typedState))?.content).toBe(
      initialContent,
    )
  })

  it("coalesces consecutive non-persistent changes into one undo level", () => {
    const initialContent = [createParagraphBlock("a", "A")]
    const firstKeystroke = [createParagraphBlock("a", "AB")]
    const secondKeystroke = [createParagraphBlock("a", "ABC")]

    let state = updateCurrentEditorHistoryEntry(
      initializeEditorHistory(initialContent),
      createEditorHistoryEntry(firstKeystroke),
    )
    state = updateCurrentEditorHistoryEntry(state, createEditorHistoryEntry(secondKeystroke))

    expect(state.entries).toHaveLength(2)
    expect(state.index).toBe(1)
    expect(getCurrentEditorHistoryEntry(state)?.content).toBe(secondKeystroke)
    expect(getCurrentEditorHistoryEntry(undoEditorHistory(state))?.content).toBe(initialContent)
  })

  it("opens a new undo level for the first non-persistent change after a persistent one", () => {
    const initialContent = [createParagraphBlock("initial", "A")]
    const persistentContent = [createParagraphBlock("persistent", "AB")]
    const nonPersistentContent = [createParagraphBlock("non-persistent", "ABC")]

    const persistentState = pushEditorHistoryEntry(
      initializeEditorHistory(initialContent),
      createEditorHistoryEntry(persistentContent, {
        selectionStart: { clientId: "persistent", offset: 2 },
      }),
    )
    const nonPersistentState = updateCurrentEditorHistoryEntry(
      persistentState,
      createEditorHistoryEntry(nonPersistentContent, {
        selectionStart: { clientId: "non-persistent", offset: 3 },
      }),
    )

    expect(nonPersistentState.entries).toHaveLength(3)
    expect(nonPersistentState.index).toBe(2)
    expect(getCurrentEditorHistoryEntry(nonPersistentState)?.content).toBe(nonPersistentContent)
    expect(getCurrentEditorHistoryEntry(nonPersistentState)?.selection?.selectionStart).toEqual({
      clientId: "non-persistent",
      offset: 3,
    })

    const undoneState = undoEditorHistory(nonPersistentState)
    expect(getCurrentEditorHistoryEntry(undoneState)?.content).toBe(persistentContent)

    const redoneState = redoEditorHistory(undoneState)
    expect(getCurrentEditorHistoryEntry(redoneState)?.content).toBe(nonPersistentContent)
  })

  it("promotes the current entry when a persistent change reports the same content", () => {
    const initialContent = [createParagraphBlock("a", "A")]
    const typedContent = [createParagraphBlock("a", "AB")]

    const typedState = updateCurrentEditorHistoryEntry(
      initializeEditorHistory(initialContent),
      createEditorHistoryEntry(typedContent),
    )
    const markedPersistentState = pushEditorHistoryEntry(
      typedState,
      createEditorHistoryEntry(typedContent),
    )

    expect(markedPersistentState.entries).toHaveLength(2)
    expect(markedPersistentState.index).toBe(1)
    expect(getCurrentEditorHistoryEntry(markedPersistentState)?.transient).toBeUndefined()

    const keystrokeAfterPromotion = updateCurrentEditorHistoryEntry(
      markedPersistentState,
      createEditorHistoryEntry([createParagraphBlock("a", "ABC")]),
    )

    expect(keystrokeAfterPromotion.entries).toHaveLength(3)
    expect(getCurrentEditorHistoryEntry(undoEditorHistory(keystrokeAfterPromotion))?.content).toBe(
      typedContent,
    )
  })

  it("drops redo branch when the current entry is updated after undo", () => {
    const initialState = initializeEditorHistory([createParagraphBlock("a", "A")])
    const secondState = pushEditorHistoryEntry(
      initialState,
      createEditorHistoryEntry([createParagraphBlock("b", "B")]),
    )
    const thirdState = pushEditorHistoryEntry(
      secondState,
      createEditorHistoryEntry([createParagraphBlock("c", "C")]),
    )

    const undoneState = undoEditorHistory(thirdState)
    expect(undoneState.entries).toHaveLength(3)

    const updatedState = updateCurrentEditorHistoryEntry(
      undoneState,
      createEditorHistoryEntry([createParagraphBlock("b2", "B2")]),
    )

    expect(updatedState.entries).toHaveLength(3)
    expect(updatedState.index).toBe(2)
    // safe: test data always has at least one content block
    expect(getCurrentEditorHistoryEntry(updatedState)?.content[0]!.clientId).toBe("b2")
    expect(canRedoEditorHistory(updatedState)).toBe(false)

    const branchedState = pushEditorHistoryEntry(
      updatedState,
      createEditorHistoryEntry([createParagraphBlock("d", "D")]),
    )

    expect(branchedState.index).toBe(3)
    // safe: test data always has at least one content block per entry
    expect(branchedState.entries.map((entry) => entry.content[0]!.clientId)).toEqual([
      "a",
      "b",
      "b2",
      "d",
    ])
  })

  it("drops redo history when a new persistent change is made after undo", () => {
    const initialState = initializeEditorHistory([createParagraphBlock("a", "A")])
    const secondState = pushEditorHistoryEntry(
      initialState,
      createEditorHistoryEntry([createParagraphBlock("b", "B")]),
    )
    const thirdState = pushEditorHistoryEntry(
      secondState,
      createEditorHistoryEntry([createParagraphBlock("c", "C")]),
    )

    const undoneState = undoEditorHistory(thirdState)
    const branchedState = pushEditorHistoryEntry(
      undoneState,
      createEditorHistoryEntry([createParagraphBlock("d", "D")]),
    )

    expect(branchedState.entries).toHaveLength(3)
    expect(branchedState.index).toBe(2)
    // safe: test data always has at least one content block per entry
    expect(branchedState.entries.map((entry) => entry.content[0]!.clientId)).toEqual([
      "a",
      "b",
      "d",
    ])
  })

  describe("recordEditorHistoryChange", () => {
    it("leaves the history untouched for undo-ignored changes", () => {
      const initialState = initializeEditorHistory([createParagraphBlock("a", "A")])
      const ignoredEntry = createEditorHistoryEntry([createParagraphBlock("a", "AB")])

      expect(
        recordEditorHistoryChange(initialState, ignoredEntry, {
          persistent: false,
          undoIgnore: true,
        }),
      ).toBe(initialState)
      expect(
        recordEditorHistoryChange(initialState, ignoredEntry, {
          persistent: true,
          undoIgnore: true,
        }),
      ).toBe(initialState)
    })

    it("round-trips undo and redo across a sequence of input and change reports", () => {
      const initialContent = [createParagraphBlock("a", "A")]
      const typedContent = [createParagraphBlock("a", "AB")]
      const splitContent = [createParagraphBlock("a", "AB"), createParagraphBlock("b", "")]
      const ignoredContent = [createParagraphBlock("a", "AB"), createParagraphBlock("b", "C")]
      const typedInSecondBlockContent = [
        createParagraphBlock("a", "AB"),
        createParagraphBlock("b", "CD"),
      ]

      let state = initializeEditorHistory(initialContent)
      state = recordEditorHistoryChange(state, createEditorHistoryEntry(typedContent), {
        persistent: false,
      })
      state = recordEditorHistoryChange(state, createEditorHistoryEntry(splitContent), {
        persistent: true,
      })
      state = recordEditorHistoryChange(state, createEditorHistoryEntry(ignoredContent), {
        persistent: true,
        undoIgnore: true,
      })
      state = recordEditorHistoryChange(
        state,
        createEditorHistoryEntry(typedInSecondBlockContent),
        { persistent: false },
      )

      expect(state.entries.map((entry) => entry.content)).toEqual([
        initialContent,
        typedContent,
        splitContent,
        typedInSecondBlockContent,
      ])

      const undoneOnce = undoEditorHistory(state)
      expect(getCurrentEditorHistoryEntry(undoneOnce)?.content).toBe(splitContent)

      const undoneToStart = undoEditorHistory(undoEditorHistory(undoneOnce))
      expect(getCurrentEditorHistoryEntry(undoneToStart)?.content).toBe(initialContent)
      expect(canUndoEditorHistory(undoneToStart)).toBe(false)

      const redoneToEnd = redoEditorHistory(redoEditorHistory(redoEditorHistory(undoneToStart)))
      expect(getCurrentEditorHistoryEntry(redoneToEnd)?.content).toBe(typedInSecondBlockContent)
      expect(canRedoEditorHistory(redoneToEnd)).toBe(false)
    })
  })
})
