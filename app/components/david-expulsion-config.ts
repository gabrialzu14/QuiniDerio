/** Versioned, editorially controlled announcements.
 * The announcement is enabled with a name-only portrait until a real photo is provided.
 * The version is stored per authenticated user and device.
 */
export const DAVID_EXPULSION = {
  version:"david-first-assistant-red-2026-v1",
  enabled:true,
  photoSrc:null as string|null,
  message:"🟥 PRIMER 2º entrenador Expulsado!",
} as const;
