/**
 * Messages between the CMS research form editor and the main-frontend preview page. The preview
 * sends `ready` when it opens; the editor answers it, and follows every edit, with a `draft`.
 */
export type ResearchFormPreviewMessage = { type: "ready" } | { type: "draft"; content: unknown }

/** Both apps are served from the same origin, which BroadcastChannel requires. */
export function openResearchFormPreviewChannel(courseId: string): BroadcastChannel {
  return new BroadcastChannel(`research-form-preview:${courseId}`)
}
