// These packages ship no types, so noImplicitAny fails on every import. Declare them untyped
// (resolving to `any`), matching the pre-strict-mode behavior.
declare module "@wordpress/block-editor"
declare module "@wordpress/block-library"
