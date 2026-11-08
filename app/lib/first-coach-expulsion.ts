/** An independent notice: reading it never changes predictions or points. */
export const FIRST_COACH_EXPULSION = {
  announcementId: "peio-garcia-first-coach-red-2026-11-08-v1",
  name: "PEIO GARCIA",
  team: "Juvenil A",
  photo: "/api/assets/entrenadores/PeioGarcia2.png?opt=4",
} as const;

export type AnnouncementAcknowledgement = {announcement_id: string};

/** An already-read notice wins; otherwise the complete coach change comes first. */
export function firstCoachNoticeState(
  acknowledgements: readonly AnnouncementAcknowledgement[],
  coachChangeId: string,
): "seen" | "waiting" | "ready" {
  const read = new Set(acknowledgements.map(row => row.announcement_id));
  if (read.has(FIRST_COACH_EXPULSION.announcementId)) return "seen";
  return read.has(coachChangeId) ? "ready" : "waiting";
}
