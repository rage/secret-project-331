// These packages ship no type entry point, so noImplicitAny fails on every import. Members are
// listed one by one rather than left as a blanket untyped module so that importing a name we do not
// depend on is a compile error; each stays `any` because there are no upstream types to borrow.
//
// The list cannot tell whether Gutenberg still exports these — only
// tests/utils/wordpressApiSurface.test.ts can, and it fails if the two disagree.

/* oxlint-disable typescript/no-explicit-any */
declare module "@wordpress/block-editor" {
  export const BlockControls: any
  export const BlockEditorKeyboardShortcuts: any
  export const BlockEditorProvider: any
  export const BlockIcon: any
  export const BlockInspector: any
  export const BlockList: any
  export const BlockTools: any
  export const ButtonBlockAppender: any
  export const InnerBlocks: any
  export const InspectorControls: any
  export const MediaPlaceholder: any
  export const ObserveTyping: any
  export const RichText: any
  export const WritingFlow: any
  export const __experimentalLibrary: any
  export const __experimentalListView: any
  export const __unstableEditorStyles: any
  export const __unstableUseBlockSelectionClearer: any
  export const useBlockProps: any
}

declare module "@wordpress/block-library" {
  export const __experimentalGetCoreBlocks: any
  export const registerCoreBlocks: any
}
