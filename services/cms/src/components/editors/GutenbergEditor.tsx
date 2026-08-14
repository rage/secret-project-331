"use client"

/**
 * WordPress dependencies
 */
import "@wordpress/components/build-style/style.css"
import "@wordpress/block-editor/build-style/style.css"
// Reverts the host page's global CSS inside the canvas so course-material styling starts from
// browser defaults. Must precede block-library's style.css, which is built to override it, and only
// works paired with the typography in editorContentStyles — on its own it leaves the canvas serif.
import "@wordpress/block-library/build-style/reset.css"
import "@wordpress/block-library/build-style/style.css"
// Canvas styles, as opposed to the editor chrome in block-editor's style.css. Carries the focus
// ring resets, the rich text placeholder text, and the positioning contexts the appenders and
// insertion points rely on. Load order follows WordPress's own wp-edit-blocks dependency chain.
import "@wordpress/block-editor/build-style/content.css"
import "@wordpress/block-library/build-style/theme.css"
import "@wordpress/block-library/build-style/editor.css"
// Styles the link, colour and language format popovers. Resolves only through the alias in
// next.config.js, because format-library's package exports do not expose build-style.
import "@wordpress/format-library/build-style/style.css"
import { css } from "@emotion/css"
import {
  BlockEditorKeyboardShortcuts,
  BlockEditorProvider,
  BlockInspector,
  __experimentalLibrary as BlockLibrary,
  BlockList,
  BlockTools,
  ButtonBlockAppender,
  __unstableEditorStyles as EditorStyles,
  __experimentalListView as ListView,
  ObserveTyping,
  __unstableUseBlockSelectionClearer as useBlockSelectionClearer,
  WritingFlow,
} from "@wordpress/block-editor"
// This import is needed for bold, italics, ... formatting
import "@wordpress/format-library"
import { Popover, SlotFillProvider } from "@wordpress/components"
import { useMergeRefs } from "@wordpress/compose"
import { addFilter, removeFilter } from "@wordpress/hooks"
import { ShortcutProvider } from "@wordpress/keyboard-shortcuts"
import React, { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "react-hot-toast"

import SelectField from "@/shared-module/common/components/InputFields/SelectField"
import SuccessNotification from "@/shared-module/common/components/Notifications/Success"
import Spinner from "@/shared-module/common/components/Spinner"
import type { BlockConfiguration, BlockInstance } from "@/utils/Gutenberg/types"
import { useTranslation } from "@/utils/useCmsTranslation"

import useDisableBrowserDefaultDragFileBehavior from "../../hooks/useDisableBrowserDefaultDragFileBehavior"
import useSidebarStartingYCoodrinate from "../../hooks/useSidebarStartingYCoodrinate"
import type { MediaUploadProps } from "../../services/mediaUpload"
import {
  ensureStandaloneGutenbergBootstrap,
  getDefaultAllowedBlockTypes,
} from "../../utils/Gutenberg/bootstrapStandaloneGutenberg"
import { editorContentStyles } from "../../utils/Gutenberg/editorContentStyles"
import {
  createEditorHistoryEntry,
  getCurrentEditorHistoryEntry,
  type GutenbergEditorSelection,
  initializeEditorHistory,
  recordEditorHistoryChange,
  redoEditorHistory,
  undoEditorHistory,
} from "../../utils/Gutenberg/editorHistory"
import runMigrationsAndValidations from "../../utils/Gutenberg/runMigrationsAndValidations"
import withCustomHtmlParagraphWarning from "../../utils/Gutenberg/withCustomHtmlParagraphWarning"
import withHeadingHierarchyWarnings from "../../utils/Gutenberg/withHeadingHierarchyWarnings"
import withImageFocalPointReset from "../../utils/Gutenberg/withImageFocalPointReset"
import withImageWarnings from "../../utils/Gutenberg/withImageWarnings"
import withParagraphWarnings from "../../utils/Gutenberg/withParagraphWarnings"
import CommonKeyboardShortcuts from "../CommonKeyboardShortcuts"

// oxlint-disable-next-line typescript/no-explicit-any
type CustomBlockDefinition = [string, BlockConfiguration<Record<string, any>>]

/** One entry of `settings.styles`: canvas CSS that only reaches the DOM through `EditorStyles`. */
interface EditorContentStyle {
  css: string
}

// Hoisted because EditorStyles is memoized: a new object on each render would defeat that.
const EDITOR_STYLE_TRANSFORM_OPTIONS = {
  ignoredSelectors: [/\.editor-styles-wrapper/gi],
}
// oxlint-disable-next-line i18next/no-literal-string
const EDITOR_STYLES_SCOPE = ":where(.editor-styles-wrapper)"

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
  /** Set by Gutenberg for changes that must not become an undo level. */
  undoIgnore?: boolean
}

interface EditorCanvasProps {
  contentRef: React.RefObject<HTMLDivElement | null>
}

/**
 * The editable block canvas.
 *
 * Must render inside `BlockEditorProvider`: the provider runs on a private data sub-registry, and the
 * selection clearer only sees blocks when it resolves the block editor store against that registry.
 */
const EditorCanvas: React.FC<React.PropsWithChildren<EditorCanvasProps>> = ({
  contentRef,
  children,
}) => {
  const clearerRef = useBlockSelectionClearer()
  const mergedContentRef = useMergeRefs([clearerRef, contentRef])

  return (
    <WritingFlow
      ref={mergedContentRef}
      className="editor-styles-wrapper"
      tabIndex={-1}
      // oxlint-disable-next-line react/forbid-component-props
      style={{
        height: "100%",
        width: "100%",
      }}
    >
      {children}
    </WritingFlow>
  )
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
  const localRef = useRef<HTMLDivElement>(null)

  const [isGutenbergBootstrapped, setIsGutenbergBootstrapped] = useState(false)
  const [isEditorMounted, setIsEditorMounted] = useState(false)
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
    Partial<{
      mediaUpload: (props: MediaUploadProps) => void
      styles: readonly EditorContentStyle[]
      [key: string]: unknown
    }>
  >(
    () => ({
      disableCustomColors: false,
      disableCustomFontSizes: false,
      styles: editorContentStyles,
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
    historyRef.current = recordEditorHistoryChange(
      historyRef.current,
      createEditorHistoryEntry(newContent, nextSelection),
      { persistent: true, undoIgnore: options?.undoIgnore },
    )
    dispatchContentChange(newContent)
  }

  const handleInput = (
    newContent: BlockInstance[],
    options?: GutenbergEditorChangeOptions,
  ): void => {
    const nextSelection = options?.selection ?? selectionRef.current

    setSelectionState(nextSelection)
    historyRef.current = recordEditorHistoryChange(
      historyRef.current,
      createEditorHistoryEntry(newContent, nextSelection),
      { persistent: false, undoIgnore: options?.undoIgnore },
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
    // oxlint-disable-next-line i18next/no-literal-string
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

  useEffect(() => {
    addFilter("editor.BlockEdit", "moocfi/cms/paragraphWarnings", withParagraphWarnings)
    return () => {
      removeFilter("editor.BlockEdit", "moocfi/cms/paragraphWarnings")
    }
  }, [])

  useEffect(() => {
    addFilter("editor.BlockEdit", "moocfi/cms/imageWarnings", withImageWarnings)
    return () => {
      removeFilter("editor.BlockEdit", "moocfi/cms/imageWarnings")
    }
  }, [])

  useEffect(() => {
    addFilter("editor.BlockEdit", "moocfi/cms/imageFocalPointReset", withImageFocalPointReset)
    return () => {
      removeFilter("editor.BlockEdit", "moocfi/cms/imageFocalPointReset")
    }
  }, [])

  useEffect(() => {
    addFilter(
      "editor.BlockEdit",
      "moocfi/cms/headingHierarchyWarnings",
      withHeadingHierarchyWarnings,
    )
    return () => {
      removeFilter("editor.BlockEdit", "moocfi/cms/headingHierarchyWarnings")
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

  // Only the first migration pass may keep the editor unmounted. Later passes run with it mounted,
  // because a remount rebuilds BlockEditorProvider's data sub-registry and takes the selection, caret
  // position, undo history and generated style overrides with it.
  const showEditor =
    isGutenbergBootstrapped && (isEditorMounted || !needToRunMigrationsAndValidations)

  useEffect(() => {
    if (showEditor) {
      setIsEditorMounted(true)
    }
  }, [showEditor])

  if (!showEditor) {
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
                        // oxlint-disable-next-line i18next/no-literal-string
                        { value: "block-props", label: t("block-props") },
                        // oxlint-disable-next-line i18next/no-literal-string
                        { value: "block-list", label: t("block-list") },
                        // oxlint-disable-next-line i18next/no-literal-string
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
                <BlockEditorKeyboardShortcuts.Register />
                <CommonKeyboardShortcuts onUndo={handleUndo} onRedo={handleRedo} />
                <EditorStyles
                  styles={editorSettings.styles}
                  scope={EDITOR_STYLES_SCOPE}
                  transformOptions={EDITOR_STYLE_TRANSFORM_OPTIONS}
                />
                <EditorCanvas contentRef={localRef}>
                  <ObserveTyping>
                    <BlockList />

                    {content.length > 0 && <ButtonBlockAppender rootClientId={undefined} />}
                  </ObserveTyping>
                </EditorCanvas>
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
