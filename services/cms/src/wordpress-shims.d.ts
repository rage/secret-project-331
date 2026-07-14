// @wordpress/block-editor and @wordpress/block-library ship no type declarations
// (their package.json has no "types" field and no exports."types" entry). Under strict mode
// noImplicitAny would fail on every import from them. Declaring them as untyped modules keeps
// them resolving to `any`, matching the behavior before strict mode was enabled.
declare module "@wordpress/block-editor"
declare module "@wordpress/block-library"
