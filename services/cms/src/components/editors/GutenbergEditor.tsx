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
  BlockList,
  EditorBlockListSettings,
  EditorSettings,
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
  unregisterBlockType,
  /* @ts-ignore: type signature incorrect */
  unregisterBlockVariation,
} from "@wordpress/blocks"
import { Popover, SlotFillProvider } from "@wordpress/components"
import { addFilter } from "@wordpress/hooks"
// @ts-ignore: no types
import { ShortcutProvider } from "@wordpress/keyboard-shortcuts"
import React, { useEffect, useState } from "react"

import { MediaUploadProps } from "../../services/backend/media/mediaUpload"
import { modifyBlockAttributes } from "../../utils/Gutenberg/modifyBlockAttributes"
import { modifyBlockButton } from "../../utils/Gutenberg/modifyBlockButton"

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
  const [editorSettings, setEditorSettings] = useState<
    Partial<
      EditorSettings & EditorBlockListSettings & { mediaUpload: (props: MediaUploadProps) => void }
    >
  >({})

  useEffect(() => {
    setEditorSettings((prev) => ({ ...prev, mediaUpload }))
  }, [mediaUpload])

  const handleChanges = (newContent: BlockInstance[]): void => {
    onContentChange(newContent)
  }
  const handleInput = (newContent: BlockInstance[]): void => {
    onContentChange(newContent)
  }

  // Media upload gallery not yet supported, uncommenting this will add a button besides the "Upload" button.
  // addFilter("editor.MediaUpload", "moocfi/cms/replace-media-upload", mediaUploadGallery)

  // Ensure that type core/image has some attributes set to a value, so that the CMS/image block doesn't crash when uploading image.
  // eslint-disable-next-line i18next/no-literal-string
  addFilter("blocks.registerBlockType", "moocfi/cms/modify-blockAttributes", modifyBlockAttributes)

  useEffect(() => {
    // Register all core blocks
    registerCoreBlocks()

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

  return (
    <div
      className={css`
        padding-top: 1rem;
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
                  `}
                >
                  <BlockInspector />
                </div>
                {inspectorButtons && (
                  <div
                    className={css`
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
