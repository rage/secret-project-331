/**
 * WordPress dependencies
 */
// This import is needed for bold, italics, ... formatting
import "@wordpress/format-library"

import "@wordpress/components/build-style/style.css"
import "@wordpress/block-editor/build-style/style.css"
import "@wordpress/block-library/build-style/style.css"
import "@wordpress/block-library/build-style/theme.css"
import "@wordpress/block-library/build-style/editor.css"
import "@wordpress/format-library/build-style/style.css"
import { css } from "@emotion/css"
import {
  BlockEditorKeyboardShortcuts,
  BlockEditorProvider,
  BlockInspector,
  // @ts-expect-error: no type definition
  __experimentalLibrary as BlockLibrary,
  BlockList,
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
// @ts-expect-error: no type definition
import { BlockTools } from "@wordpress/block-editor/build-module/components/"
import { registerCoreBlocks } from "@wordpress/block-library"
import {
  BlockInstance,
  getBlockType,
  getBlockTypes,
  registerBlockType,
  setCategories,
  unregisterBlockType,
  unregisterBlockVariation,
} from "@wordpress/blocks"
import { Popover, SlotFillProvider } from "@wordpress/components"
import { useMergeRefs } from "@wordpress/compose"
import { addFilter, removeFilter } from "@wordpress/hooks"
// @ts-expect-error: no types
import { ShortcutProvider } from "@wordpress/keyboard-shortcuts"
import React, { useEffect, useRef, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

import useDisableBrowserDefaultDragFileBehavior from "../../hooks/useDisableBrowserDefaultDragFileBehavior"
import useSidebarStartingYCoodrinate from "../../hooks/useSidebarStartingYCoodrinate"
import { MediaUploadProps } from "../../services/backend/media/mediaUpload"
import {
  modifyEmbedBlockAttributes,
  modifyImageBlockAttributes,
} from "../../utils/Gutenberg/modifyBlockAttributes"
import { modifyBlockButton } from "../../utils/Gutenberg/modifyBlockButton"
import { modifyGutenbergCategories } from "../../utils/Gutenberg/modifyGutenbergCategories"
import { registerBlockVariations } from "../../utils/Gutenberg/registerBlockVariations"
import runMigrationsAndValidations from "../../utils/Gutenberg/runMigrationsAndValidations"
import withMentimeterInspector from "../../utils/Gutenberg/withMentimeterInspector"
import CommonKeyboardShortcuts from "../CommonKeyboardShortcuts"

import SelectField from "@/shared-module/common/components/InputFields/SelectField"
import SuccessNotification from "@/shared-module/common/components/Notifications/Success"
import Spinner from "@/shared-module/common/components/Spinner"
import { primaryFont } from "@/shared-module/common/styles"
import editBlockThemeJsonSettings from "@/utils/Gutenberg/editBlockThemeJsonSettings"

interface GutenbergEditorProps {
  content: BlockInstance[]
  onContentChange: React.Dispatch<BlockInstance[]>
  allowedBlocks?: string[]
  allowedBlockVariations?: Record<string, string[]>
  customBlocks?: Array<Parameters<typeof registerBlockType>>
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

  const [editorSettings, setEditorSettings] = useState<
    Partial<
      EditorSettings & EditorBlockListSettings & { mediaUpload: (props: MediaUploadProps) => void }
    >
  >({
    disableCustomColors: false,
    disableCustomEditorFontSizes: false,
    styles: [],
    codeEditingEnabled: false,
  })

  const sideBarStartingYCoordinate = useSidebarStartingYCoodrinate()

  useEffect(() => {
    setEditorSettings((prev) => ({ ...prev, mediaUpload }))
  }, [mediaUpload])

  const handleChanges = (newContent: BlockInstance[]): void => {
    onContentChange(newContent)
  }
  const handleInput = (newContent: BlockInstance[]): void => {
    onContentChange(newContent)
  }

  const [sidebarView, setSidebarView] = useState<
    "block-props" | "block-list" | "block-menu" | string
  >(
    // eslint-disable-next-line i18next/no-literal-string
    "block-props",
  )
  useEffect(() => {
    setCategories(modifyGutenbergCategories())
  }, [])

  useEffect(() => {
    console.log("a")
    addFilter(
      "blockEditor.useSetting.before",
      "moocfi/editBlockThemeJsonSettings",
      editBlockThemeJsonSettings,
    )
    console.log("b")
    // Register all core blocks
    registerCoreBlocks()
    // We register the BlockVariation and if it's not in allowedBlockVariations, it will be removed.
    registerBlockVariations()

    // Unregister unwanted blocks
    if (allowedBlocks) {
      getBlockTypes().forEach((block) => {
        if (allowedBlocks.indexOf(block.name) === -1) {
          unregisterBlockType(block.name)
        }
      })
    }

    // Unregister unwanted block variations
    if (allowedBlockVariations) {
      for (const [blockName, allowedVariations] of Object.entries(allowedBlockVariations)) {
        /* @ts-ignore: type signature incorrect */
        getBlockType(blockName)?.variations?.forEach((variation) => {
          if (allowedVariations.indexOf(variation.name) === -1) {
            unregisterBlockVariation(blockName, variation.name)
          }
        })
      }
    }

    // Register own blocks
    if (customBlocks) {
      customBlocks.forEach(([blockName, block]) => {
        registerBlockType(blockName, block)
      })
    }

    // Remove Gutenberg Default Button styles and add own
    modifyBlockButton()

    // core/image block crashes if there's no wp global. Setting it to null is enough fix the existing null checks
    // in the core/image code.
    // @ts-expect-error: setting a global
    window.wp = null
  }, [allowedBlockVariations, allowedBlocks, customBlocks])

  addFilter("blocks.registerBlockType", "moocfi/modifyImageAttributes", modifyImageBlockAttributes)
  addFilter("blocks.registerBlockType", "moocfi/modifyEmbedAttributes", modifyEmbedBlockAttributes)

  // Media upload gallery not yet supported, uncommenting this will add a button besides the "Upload" button.
  // addFilter("editor.MediaUpload", "moocfi/cms/replace-media-upload", mediaUploadGallery)

  /**
   * editor.BlockEdit edits the edit function for a block
   * Add the custom attributes for the Mentimeter to the sidebar.
   */
  useEffect(() => {
    addFilter("editor.BlockEdit", "moocfi/cms/mentiMeterInspector", withMentimeterInspector)
    return () => {
      removeFilter("editor.BlockEdit", "moocfi/cms/mentiMeterInspector")
    }
  }, [])

  // This **should** be the last useEffect as it supposes that Gutenberg is fully set up
  // Runs migrations and validations for the blocks
  useEffect(() => {
    if (!needToRunMigrationsAndValidations) {
      return
    }
    const [updatedContent, numberOfBlocksMigrated] = runMigrationsAndValidations(content)
    setNeedToRunMigrationsAndValidations(false)
    onContentChange(updatedContent)
    if (numberOfBlocksMigrated > 0) {
      // eslint-disable-next-line i18next/no-literal-string
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
    needToRunMigrationsAndValidations,
    onContentChange,
    setNeedToRunMigrationsAndValidations,
    t,
  ])

  if (needToRunMigrationsAndValidations) {
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
                  {/* @ts-ignore: type signature incorrect */}
                  <BlockEditorKeyboardShortcuts.Register />
                  <CommonKeyboardShortcuts />
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
                      <ButtonBlockAppender
                        // @ts-expect-error: Typically this component is used to insert innerblocks. However, we are using it to insert blocks at the root level.
                        rootClientId={undefined}
                      />
                    </ObserveTyping>
                  </WritingFlow>
                </div>
              </BlockTools>
            </div>
            {/* @ts-expect-error: slot is not in the type definitions */}
            <Popover.Slot />
          </BlockEditorProvider>
        </SlotFillProvider>
      </ShortcutProvider>
    </div>
  )
}

export default GutenbergEditor
