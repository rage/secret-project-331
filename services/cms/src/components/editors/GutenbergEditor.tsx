"use client"

/**
 * WordPress dependencies
 */
import "@wordpress/components/build-style/style.css"
import "@wordpress/block-editor/build-style/style.css"
import "@wordpress/block-library/build-style/style.css"
import "@wordpress/block-library/build-style/theme.css"
import "@wordpress/block-library/build-style/editor.css"
import { css } from "@emotion/css"
import {
  BlockEditorKeyboardShortcuts,
  BlockEditorProvider,
  BlockInspector,
  // @ts-expect-error: no type definition
  __experimentalLibrary as BlockLibrary,
  BlockList,
  // @ts-expect-error: no type definition
  BlockTools,
  ButtonBlockAppender,
  EditorBlockListSettings,
  EditorSettings,
  // @ts-expect-error: no type definition
  __experimentalListView as ListView,
  ObserveTyping,
  // @ts-expect-error: no type definition
  __unstableUseBlockSelectionClearer as useBlockSelectionClearer,
  WritingFlow,
} from "@wordpress/block-editor"
// This import is needed for bold, italics, ... formatting
import "@wordpress/format-library"
import { type BlockConfiguration, BlockInstance } from "@wordpress/blocks"
import { Popover, SlotFillProvider } from "@wordpress/components"
import { useMergeRefs } from "@wordpress/compose"
import { addFilter, removeFilter } from "@wordpress/hooks"
// @ts-expect-error: no types
import { ShortcutProvider } from "@wordpress/keyboard-shortcuts"
import React, { useEffect, useMemo, useRef, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

import useDisableBrowserDefaultDragFileBehavior from "../../hooks/useDisableBrowserDefaultDragFileBehavior"
import useSidebarStartingYCoodrinate from "../../hooks/useSidebarStartingYCoodrinate"
import { MediaUploadProps } from "../../services/backend/media/mediaUpload"
import {
  ensureStandaloneGutenbergBootstrap,
  getDefaultAllowedBlockTypes,
} from "../../utils/Gutenberg/bootstrapStandaloneGutenberg"
import {
  createEditorHistoryEntry,
  getCurrentEditorHistoryEntry,
  type GutenbergEditorSelection,
  initializeEditorHistory,
  pushEditorHistoryEntry,
  redoEditorHistory,
  undoEditorHistory,
  updateCurrentEditorHistoryEntry,
} from "../../utils/Gutenberg/editorHistory"
import runMigrationsAndValidations from "../../utils/Gutenberg/runMigrationsAndValidations"
import withCustomHtmlParagraphWarning from "../../utils/Gutenberg/withCustomHtmlParagraphWarning"
import CommonKeyboardShortcuts from "../CommonKeyboardShortcuts"

import SelectField from "@/shared-module/common/components/InputFields/SelectField"
import SuccessNotification from "@/shared-module/common/components/Notifications/Success"
import Spinner from "@/shared-module/common/components/Spinner"
import { primaryFont } from "@/shared-module/common/styles"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CustomBlockDefinition = [string, BlockConfiguration<Record<string, any>>]

interface GutenbergEditorProps {
  content: BlockInstance[]
  onContentChange: React.Dispatch<BlockInstance[]>
  allowedBlocks?: string[]
  allowedBlockVariations?: Record<string, string[]>
  customBlocks?: CustomBlockDefinition[]
  mediaUpload: (props: MediaUploadProps) => void
  inspectorButtons?: JSX.Element
  /** This component has to run block migrations and validations once the Gutenberg editor and blocks have been loaded.
   * Whenever new data has been loaded from the server, the parent of this components will set this to true
   * to indicate to this component that migrations and validations should be run again.
   */
  needToRunMigrationsAndValidations: boolean
  setNeedToRunMigrationsAndValidations: React.Dispatch<boolean>
  showSidebar?: boolean
}

interface GutenbergEditorChangeOptions {
  selection?: GutenbergEditorSelection
}

const GutenbergEditor: React.FC<React.PropsWithChildren<GutenbergEditorProps>> = ({
  content,
  onContentChange,
  allowedBlockVariations,
  allowedBlocks,
  customBlocks,
  mediaUpload,
  inspectorButtons,
  needToRunMigrationsAndValidations,
  setNeedToRunMigrationsAndValidations,
  showSidebar = true,
}: GutenbergEditorProps) => {
  const { t } = useTranslation()
  useDisableBrowserDefaultDragFileBehavior()
  const clearerRef = useBlockSelectionClearer()
  const localRef = useRef()
  const contentRef = useMergeRefs([clearerRef, localRef])

  const [isGutenbergBootstrapped, setIsGutenbergBootstrapped] = useState(false)
  const historyRef = useRef(initializeEditorHistory(content))
  const selectionRef = useRef<GutenbergEditorSelection | undefined>(undefined)
  const localContentUpdateRef = useRef<BlockInstance[] | null>(null)
  const [selection, setSelection] = useState<GutenbergEditorSelection | undefined>(undefined)

  const sideBarStartingYCoordinate = useSidebarStartingYCoodrinate()

  useEffect(() => {
    ensureStandaloneGutenbergBootstrap({ allowedBlockVariations, customBlocks })
    setIsGutenbergBootstrapped(true)
  }, [allowedBlockVariations, customBlocks])

  const allowedBlockTypes = useMemo(() => {
    if (!allowedBlocks && !customBlocks) {
      if (!isGutenbergBootstrapped) {
        return []
      }

      return getDefaultAllowedBlockTypes()
    }

    return Array.from(
      new Set([...(allowedBlocks ?? []), ...(customBlocks?.map(([blockName]) => blockName) ?? [])]),
    )
  }, [allowedBlocks, customBlocks, isGutenbergBootstrapped])

  const editorSettings = useMemo<
    Partial<
      EditorSettings & EditorBlockListSettings & { mediaUpload: (props: MediaUploadProps) => void }
    >
  >(
    () => ({
      disableCustomColors: false,
      disableCustomEditorFontSizes: false,
      styles: [],
      codeEditingEnabled: false,
      mediaUpload,
      allowedBlockTypes,
    }),
    [allowedBlockTypes, mediaUpload],
  )

  useEffect(() => {
    if (localContentUpdateRef.current === content) {
      localContentUpdateRef.current = null
      return
    }

    historyRef.current = initializeEditorHistory(content)
    selectionRef.current = undefined
    setSelection(undefined)
  }, [content])

  const setSelectionState = (nextSelection?: GutenbergEditorSelection) => {
    selectionRef.current = nextSelection
    setSelection(nextSelection)
  }

  const dispatchContentChange = (newContent: BlockInstance[]) => {
    localContentUpdateRef.current = newContent
    onContentChange(newContent)
  }

  const handleChanges = (
    newContent: BlockInstance[],
    options?: GutenbergEditorChangeOptions,
  ): void => {
    const nextSelection = options?.selection ?? selectionRef.current

    setSelectionState(nextSelection)
    historyRef.current = pushEditorHistoryEntry(
      historyRef.current,
      createEditorHistoryEntry(newContent, nextSelection),
    )
    dispatchContentChange(newContent)
  }

  const handleInput = (
    newContent: BlockInstance[],
    options?: GutenbergEditorChangeOptions,
  ): void => {
    const nextSelection = options?.selection ?? selectionRef.current

    setSelectionState(nextSelection)
    historyRef.current = updateCurrentEditorHistoryEntry(
      historyRef.current,
      createEditorHistoryEntry(newContent, nextSelection),
    )
    dispatchContentChange(newContent)
  }

  const handleUndo = () => {
    const nextHistory = undoEditorHistory(historyRef.current)

    if (nextHistory.index === historyRef.current.index) {
      return
    }

    historyRef.current = nextHistory
    const nextEntry = getCurrentEditorHistoryEntry(nextHistory)
    setSelectionState(nextEntry?.selection)
    if (nextEntry) {
      dispatchContentChange(nextEntry.content)
    }
  }

  const handleRedo = () => {
    const nextHistory = redoEditorHistory(historyRef.current)

    if (nextHistory.index === historyRef.current.index) {
      return
    }

    historyRef.current = nextHistory
    const nextEntry = getCurrentEditorHistoryEntry(nextHistory)
    setSelectionState(nextEntry?.selection)
    if (nextEntry) {
      dispatchContentChange(nextEntry.content)
    }
  }

  const [sidebarView, setSidebarView] = useState<
    "block-props" | "block-list" | "block-menu" | string
  >(
    // eslint-disable-next-line i18next/no-literal-string
    "block-props",
  )

  useEffect(() => {
    addFilter(
      "editor.BlockEdit",
      "moocfi/cms/customHtmlParagraphWarning",
      withCustomHtmlParagraphWarning,
    )
    return () => {
      removeFilter("editor.BlockEdit", "moocfi/cms/customHtmlParagraphWarning")
    }
  }, [])

  // This **should** be the last useEffect as it supposes that Gutenberg is fully set up
  // Runs migrations and validations for the blocks
  useEffect(() => {
    if (!isGutenbergBootstrapped || !needToRunMigrationsAndValidations) {
      return
    }
    const [updatedContent, numberOfBlocksMigrated] = runMigrationsAndValidations(content)
    setNeedToRunMigrationsAndValidations(false)
    onContentChange(updatedContent)
    if (numberOfBlocksMigrated > 0) {
      console.info(`Ran ${numberOfBlocksMigrated} block migrations`)
      toast.custom(
        () => {
          return (
            <SuccessNotification
              header={t("title-outdated-blocks-migrated")}
              message={t("outdated-blocks-migrated-explanation", { num: numberOfBlocksMigrated })}
            />
          )
        },
        { duration: 600000 },
      )
    }
  }, [
    content,
    isGutenbergBootstrapped,
    needToRunMigrationsAndValidations,
    onContentChange,
    setNeedToRunMigrationsAndValidations,
    t,
  ])

  if (!isGutenbergBootstrapped || needToRunMigrationsAndValidations) {
    return <Spinner variant="large" />
  }

  return (
    <div
      className={css`
        padding-top: 1rem;
        --start-sidebar-top-px: ${sideBarStartingYCoordinate}px;

        /** A browser extension inserts these on some machines and they break the list block editor **/
        /* stylelint-disable-next-line selector-type-no-unknown */
        pwa-container-wrapper {
          display: none;
        }
      `}
    >
      <ShortcutProvider>
        <SlotFillProvider>
          <BlockEditorProvider
            settings={editorSettings}
            value={content}
            onInput={handleInput}
            onChange={handleChanges}
            // @ts-expect-error: selection props exist upstream but not in our type package.
            selection={selection}
            onChangeSelection={(nextSelection: GutenbergEditorSelection | undefined) => {
              setSelectionState(nextSelection)
            }}
          >
            {showSidebar && (
              <div className="editor__sidebar">
                <div
                  className={css`
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                  `}
                >
                  <div
                    className={css`
                      display: flex;
                      flex-grow: 1;
                      overflow-y: auto;
                      overflow-x: hidden;
                    `}
                  >
                    {sidebarView === "block-props" && (
                      <div
                        className={css`
                          width: 100%;
                          .block-editor-block-inspector {
                            width: 100%;
                          }
                        `}
                      >
                        <BlockInspector />
                      </div>
                    )}
                    {sidebarView === "block-list" && (
                      <div
                        className={css`
                          height: fit-content;
                          width: 100%;
                        `}
                      >
                        <ListView
                          showNestedBlocks
                          showBlockMovers
                          __experimentalFeatures
                          __experimentalPersistentListViewFeatures
                          __experimentalHideContainerBlockActions
                        />
                      </div>
                    )}
                    {sidebarView === "block-menu" && (
                      <div
                        className={css`
                          .block-editor-inserter__main-area {
                            overflow-x: hidden;
                          }
                          .components-search-control {
                            font-family: ${primaryFont} !important;
                          }
                          /** We don't have a use for other tabs than the default tab **/
                          .block-editor-tabbed-sidebar__tablist-and-close-button {
                            display: none;
                          }
                        `}
                      >
                        <BlockLibrary />
                      </div>
                    )}
                  </div>
                  <div
                    className={css`
                      margin: 1rem;
                      margin-bottom: 0;
                    `}
                  >
                    <SelectField
                      id={"select-sidebar-view"}
                      value={sidebarView}
                      label={t("editor-select-sidebar-view")}
                      options={[
                        // eslint-disable-next-line i18next/no-literal-string
                        { value: "block-props", label: t("block-props") },
                        // eslint-disable-next-line i18next/no-literal-string
                        { value: "block-list", label: t("block-list") },
                        // eslint-disable-next-line i18next/no-literal-string
                        { value: "block-menu", label: t("block-menu") },
                      ]}
                      onChangeByValue={(val) => setSidebarView(val)}
                    />
                  </div>
                  {inspectorButtons && (
                    <div
                      className={css`
                        margin: 1rem;
                        margin-top: 0;
                      `}
                    >
                      {inspectorButtons}
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="editor__content">
              <BlockTools __unstableContentRef={localRef}>
                <div className="editor-styles-wrapper">
                  {/* @ts-expect-error: type signature incorrect */}
                  <BlockEditorKeyboardShortcuts.Register />
                  <CommonKeyboardShortcuts onUndo={handleUndo} onRedo={handleRedo} />
                  <WritingFlow
                    // @ts-expect-error: Ref missing from type definitions
                    ref={contentRef}
                    className="editor-styles-wrapper"
                    tabIndex={-1}
                    // eslint-disable-next-line react/forbid-component-props
                    style={{
                      height: "100%",
                      width: "100%",
                    }}
                  >
                    <ObserveTyping>
                      <BlockList />

                      {content.length > 0 && (
                        <ButtonBlockAppender
                          // @ts-expect-error: Typically this component is used to insert innerblocks. However, we are using it to insert blocks at the root level.
                          rootClientId={undefined}
                        />
                      )}
                    </ObserveTyping>
                  </WritingFlow>
                </div>
              </BlockTools>
            </div>
            <Popover.Slot />
          </BlockEditorProvider>
        </SlotFillProvider>
      </ShortcutProvider>
    </div>
  )
}

export default GutenbergEditor
