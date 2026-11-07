/** The Derio A prediction slot continues with its new head coach. */
export const DERIO_COACH_CHANGE = {
  announcementId: "derio-a-aner-blanco-2026-11-07-v1",
  previous: "Nando Alonso",
  current: "Aner Blanco",
  photo: "/coaches/aner-blanco-20261107.webp",
  photoLarge: "/coaches/aner-blanco-20261107-768.webp",
  previousPhoto: "/coaches/nando-alonso-20261107.webp",
} as const;

export function currentCoachName(name: string): string {
  return name === DERIO_COACH_CHANGE.previous ? DERIO_COACH_CHANGE.current : name;
}

/** Also handles drafts and old cached clients without touching other choices. */
export function normalizeCoachPredictions<T extends {firstCoach?: string; coachCards?: string}>(season: T): T {
  if (season.firstCoach !== DERIO_COACH_CHANGE.previous && season.coachCards !== DERIO_COACH_CHANGE.previous) return season;
  return {
    ...season,
    ...(season.firstCoach === DERIO_COACH_CHANGE.previous ? {firstCoach: DERIO_COACH_CHANGE.current} : {}),
    ...(season.coachCards === DERIO_COACH_CHANGE.previous ? {coachCards: DERIO_COACH_CHANGE.current} : {}),
  };
}
