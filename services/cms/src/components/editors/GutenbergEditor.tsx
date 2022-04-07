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
  // @ts-ignore: no type definition
  __experimentalLibrary as BlockLibrary,
  BlockList,
  EditorBlockListSettings,
  EditorSettings,
  // @ts-ignore: no type definition
  __experimentalListView as ListView,
  ObserveTyping,
  WritingFlow,
} from "@wordpress/block-editor"
// @ts-ignore: no type definition
import { BlockTools } from "@wordpress/block-editor/build-module/components/"
import { registerCoreBlocks } from "@wordpress/block-library"
import {
  BlockInstance,
  getBlockType,
  getBlockTypes,
  registerBlockType,
  setCategories,
  unregisterBlockType,
  /* @ts-ignore: type signature incorrect */
  unregisterBlockVariation,
} from "@wordpress/blocks"
import { Popover, SlotFillProvider } from "@wordpress/components"
import { addFilter, removeFilter } from "@wordpress/hooks"
// @ts-ignore: no types
import { ShortcutProvider } from "@wordpress/keyboard-shortcuts"
import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import useSidebarStartingYCoodrinate from "../../hooks/useSidebarStartingYCoodrinate"
import { MediaUploadProps } from "../../services/backend/media/mediaUpload"
import SelectField from "../../shared-module/components/InputFields/SelectField"
import { primaryFont } from "../../shared-module/styles"
import {
  modifyEmbedBlockAttributes,
  modifyImageBlockAttributes,
} from "../../utils/Gutenberg/modifyBlockAttributes"
import { modifyBlockButton } from "../../utils/Gutenberg/modifyBlockButton"
import { modifyGutenbergCategories } from "../../utils/Gutenberg/modifyGutenbergCategories"
import { registerBlockVariations } from "../../utils/Gutenberg/registerBlockVariations"
import withMentimeterInspector from "../../utils/Gutenberg/withMentimeterInspector"

interface GutenbergEditorProps {
  content: BlockInstance[]
  onContentChange: React.Dispatch<BlockInstance[]>
  allowedBlocks?: string[]
  allowedBlockVariations?: Record<string, string[]>
  customBlocks?: Array<Parameters<typeof registerBlockType>>
  mediaUpload: (props: MediaUploadProps) => void
  inspectorButtons?: JSX.Element
}

const GutenbergEditor: React.FC<GutenbergEditorProps> = ({
  content,
  onContentChange,
  allowedBlockVariations,
  allowedBlocks,
  customBlocks,
  mediaUpload,
  inspectorButtons,
}: GutenbergEditorProps) => {
  const { t } = useTranslation()
  const [editorSettings, setEditorSettings] = useState<
    Partial<
      EditorSettings & EditorBlockListSettings & { mediaUpload: (props: MediaUploadProps) => void }
    >
  >({})

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

  const [sidebarView, setSidebarView] = useState<"block-props" | "block-list" | "block-menu">(
    // eslint-disable-next-line i18next/no-literal-string
    "block-props",
  )
  useEffect(() => {
    setCategories(modifyGutenbergCategories())
  }, [])

  useEffect(() => {
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
        getBlockType(blockName).variations.forEach((variation) => {
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

  // eslint-disable-next-line i18next/no-literal-string
  addFilter("blocks.registerBlockType", "moocfi/modifyImageAttributes", modifyImageBlockAttributes)
  // eslint-disable-next-line i18next/no-literal-string
  addFilter("blocks.registerBlockType", "moocfi/modifyEmbedAttributes", modifyEmbedBlockAttributes)

  // Media upload gallery not yet supported, uncommenting this will add a button besides the "Upload" button.
  // addFilter("editor.MediaUpload", "moocfi/cms/replace-media-upload", mediaUploadGallery)

  /**
   * editor.BlockEdit edits the edit function for a block
   * Add the custom attributes for the Mentimeter to the sidebar.
   */
  useEffect(() => {
    // eslint-disable-next-line i18next/no-literal-string
    addFilter("editor.BlockEdit", "moocfi/cms/mentiMeterInspector", withMentimeterInspector)
    return () => {
      // eslint-disable-next-line i18next/no-literal-string
      removeFilter("editor.BlockEdit", "moocfi/cms/mentiMeterInspector")
    }
  }, [])

  return (
    <div
      className={css`
        padding-top: 1rem;
        --start-sidebar-top-px: ${sideBarStartingYCoordinate}px;
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
                    onBlur={() => {
                      // noop
                    }}
                    onChange={(val) => setSidebarView(val)}
                  />
                </div>
                {inspectorButtons && (
                  <div
                    className={css`
                      margin: 1rem;
                      margin-top: 0;
                      padding: 1rem;
                      background: #f5f6f7;
                    `}
                  >
                    {inspectorButtons}
                  </div>
                )}
              </div>
            </div>
            <div className="editor__content">
              <BlockTools>
                <div className="editor-styles-wrapper">
                  {/* @ts-ignore: type signature incorrect */}
                  <BlockEditorKeyboardShortcuts.Register />
                  <BlockEditorKeyboardShortcuts />
                  <WritingFlow>
                    <ObserveTyping>
                      <BlockList />
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
