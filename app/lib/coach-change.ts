/** The Derio A prediction slot continues with its new head coach. */
export const DERIO_COACH_CHANGE = {
  announcementId: "derio-a-aner-blanco-2026-11-07-v3",
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

export type CoachImpactProfile = {
  user_id: string;
  username: string;
  has_profile_pic?: boolean;
  season?: unknown;
};

export type CoachPredictionImpact = {
  userId: string;
  name: string;
  hasProfilePic: boolean;
  changes: {field: "firstCoach" | "coachCards"; label: string; shortLabel: string; cardColor: "red" | "yellow"}[];
};

/** Read only the two affected choices; a participant can have either or both. */
export function coachPredictionImpacts(profiles: CoachImpactProfile[]): CoachPredictionImpact[] {
  const choices = [
    {field: "firstCoach", label: "Primer entrenador expulsado", shortLabel: "Primer expulsado", cardColor: "red"},
    {field: "coachCards", label: "Entrenador con más tarjetas", shortLabel: "Más tarjetas", cardColor: "yellow"},
  ] as const;
  const impacts: CoachPredictionImpact[] = [];
  for (const profile of profiles) {
    if (!profile || typeof profile.user_id !== "string" || typeof profile.username !== "string") continue;
    if (!profile.season || typeof profile.season !== "object" || Array.isArray(profile.season)) continue;
    const season = profile.season as Record<string, unknown>;
    const changes = choices.filter(choice => season[choice.field] === DERIO_COACH_CHANGE.previous || season[choice.field] === DERIO_COACH_CHANGE.current);
    if (changes.length) impacts.push({userId: profile.user_id, name: profile.username, hasProfilePic: profile.has_profile_pic === true, changes: [...changes]});
  }
  return impacts.sort((a, b) => a.name.localeCompare(b.name, "es", {sensitivity: "base", numeric: true}));
}
