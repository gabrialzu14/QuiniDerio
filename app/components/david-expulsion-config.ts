/** Versioned, editorially controlled announcements.
 * Supply David's real photo and set enabled=true to release this announcement.
 * The version is stored per authenticated user and device.
 */
export const DAVID_EXPULSION = {
  version:"david-first-assistant-red-2026-v1",
  enabled:false,
  photoSrc:null as string|null,
  message:"🟥 PRIMER 2º entrenador Expulsado!",
} as const;
