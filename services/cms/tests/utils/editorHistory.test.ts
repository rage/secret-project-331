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

const createBlock = (
  name: string,
  clientId: string,
  innerBlocks: BlockInstance[] = [],
): BlockInstance => ({
  name,
  clientId,
  isValid: true,
  attributes: {},
  innerBlocks,
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
    it("adds no undo level for undo-ignored changes", () => {
      const initialState = initializeEditorHistory([createParagraphBlock("a", "A")])
      const ignoredContent = [createParagraphBlock("a", "AB")]
      const ignoredEntry = createEditorHistoryEntry(ignoredContent)

      for (const persistent of [false, true]) {
        const state = recordEditorHistoryChange(initialState, ignoredEntry, {
          persistent,
          undoIgnore: true,
        })

        expect(state.entries).toHaveLength(1)
        expect(state.index).toBe(0)
        expect(canUndoEditorHistory(state)).toBe(false)
        expect(getCurrentEditorHistoryEntry(state)?.content).toBe(ignoredContent)
      }
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
        ignoredContent,
        typedInSecondBlockContent,
      ])

      const undoneOnce = undoEditorHistory(state)
      expect(getCurrentEditorHistoryEntry(undoneOnce)?.content).toBe(ignoredContent)

      const undoneToStart = undoEditorHistory(undoEditorHistory(undoneOnce))
      expect(getCurrentEditorHistoryEntry(undoneToStart)?.content).toBe(initialContent)
      expect(canUndoEditorHistory(undoneToStart)).toBe(false)

      const redoneToEnd = redoEditorHistory(redoEditorHistory(redoEditorHistory(undoneToStart)))
      expect(getCurrentEditorHistoryEntry(redoneToEnd)?.content).toBe(typedInSecondBlockContent)
      expect(canRedoEditorHistory(redoneToEnd)).toBe(false)
    })

    describe("with an inner block template applied after an insertion", () => {
      const savedContent = [createParagraphBlock("a", "A")]
      const insertedContent = [createParagraphBlock("a", "A"), createBlock("moocfi/exercise", "e")]
      const templatedContent = [
        createParagraphBlock("a", "A"),
        createBlock("moocfi/exercise", "e", [
          createBlock("moocfi/exercise-settings", "settings"),
          createBlock("moocfi/exercise-slides", "slides"),
        ]),
      ]
      const typedContent = [
        createParagraphBlock("a", "AB"),
        createBlock("moocfi/exercise", "e", [
          createBlock("moocfi/exercise-settings", "settings"),
          createBlock("moocfi/exercise-slides", "slides"),
        ]),
      ]

      /** Insert a block with a template, let the template sync land, then type one character. */
      const recordInsertionAndKeystroke = () => {
        let state = initializeEditorHistory(savedContent)
        state = recordEditorHistoryChange(state, createEditorHistoryEntry(insertedContent), {
          persistent: true,
        })
        state = recordEditorHistoryChange(state, createEditorHistoryEntry(templatedContent), {
          persistent: false,
          undoIgnore: true,
        })

        return recordEditorHistoryChange(state, createEditorHistoryEntry(typedContent), {
          persistent: false,
        })
      }

      it("undoes to the templated content, not to the snapshot taken before the template", () => {
        const state = recordInsertionAndKeystroke()
        const undoneState = undoEditorHistory(state)

        expect(getCurrentEditorHistoryEntry(undoneState)?.content).toBe(templatedContent)
        // safe: the exercise block is the second block of every entry in this fixture
        expect(getCurrentEditorHistoryEntry(undoneState)?.content[1]!.innerBlocks).toHaveLength(2)
      })

      it("does not turn the template sync into an undo level", () => {
        const state = recordInsertionAndKeystroke()

        expect(state.entries).toHaveLength(3)
        expect(state.index).toBe(2)
        expect(
          getCurrentEditorHistoryEntry(undoEditorHistory(undoEditorHistory(state)))?.content,
        ).toBe(savedContent)
      })

      it("redoes back to the typed content", () => {
        const state = recordInsertionAndKeystroke()
        const undoneToStart = undoEditorHistory(undoEditorHistory(state))

        expect(canUndoEditorHistory(undoneToStart)).toBe(false)

        const redoneOnce = redoEditorHistory(undoneToStart)
        expect(getCurrentEditorHistoryEntry(redoneOnce)?.content).toBe(templatedContent)

        const redoneToEnd = redoEditorHistory(redoneOnce)
        expect(getCurrentEditorHistoryEntry(redoneToEnd)?.content).toBe(typedContent)
        expect(canRedoEditorHistory(redoneToEnd)).toBe(false)
      })
    })

    it("keeps the first edit after a save undoable when a template sync precedes it", () => {
      const savedContent = [createBlock("moocfi/exercise", "e")]
      const templatedContent = [
        createBlock("moocfi/exercise", "e", [createBlock("moocfi/exercise-slides", "slides")]),
      ]
      const editedContent = [
        createBlock("moocfi/exercise", "e", [
          createBlock("moocfi/exercise-slides", "slides"),
          createBlock("moocfi/exercise-slide", "slide"),
        ]),
      ]

      let state = initializeEditorHistory(savedContent)
      state = recordEditorHistoryChange(state, createEditorHistoryEntry(templatedContent), {
        persistent: false,
        undoIgnore: true,
      })

      expect(state.entries).toHaveLength(1)
      expect(canUndoEditorHistory(state)).toBe(false)

      state = recordEditorHistoryChange(state, createEditorHistoryEntry(editedContent), {
        persistent: false,
      })

      expect(canUndoEditorHistory(state)).toBe(true)
      expect(getCurrentEditorHistoryEntry(undoEditorHistory(state))?.content).toBe(templatedContent)
    })
  })
})
