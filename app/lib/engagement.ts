export type VoteChoice = "1" | "X" | "2";
export type VoteSummary = { total: number; counts: [number, number, number]; percentages: [number, number, number] };

/** Distribute integer display percentages by largest remainder, always totalling 100. */
export function summarizeVotes(picks: readonly string[]): VoteSummary {
  const choices: VoteChoice[] = ["1", "X", "2"];
  const counts = choices.map(choice => picks.filter(pick => pick === choice).length) as [number, number, number];
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (!total) return {total: 0, counts, percentages: [0, 0, 0]};
  const fractional = counts.map(count => count * 100 / total);
  const percentages = fractional.map(value => Math.floor(value)) as [number, number, number];
  const ordered = [0, 1, 2].sort((a, b) => fractional[b] - percentages[b] - (fractional[a] - percentages[a]) || a - b);
  let remainder = 100 - percentages.reduce((sum, value) => sum + value, 0);
  for (const index of ordered) { if (!remainder) break; percentages[index]++; remainder--; }
  return {total, counts, percentages};
}

export type RoundHit = { user_id: string; round: number; hits: number };
export function roundPosition(rows: readonly RoundHit[], userId: string, throughRound: number, exactRound = false): number | null {
  if (!userId || throughRound < 1) return null;
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (exactRound ? row.round !== throughRound : row.round > throughRound) continue;
    totals.set(row.user_id, (totals.get(row.user_id) || 0) + Number(row.hits || 0));
  }
  const mine = totals.get(userId);
  if (mine === undefined) return null;
  return 1 + Array.from(totals.values()).filter(value => value > mine).length;
}

/** Existing pot rules: perfect score -3 €, lowest distinct score +2 €, second lowest +1 €. */
export function roundPotContribution(rows: readonly RoundHit[], userId: string, round: number, countableMatches: number): number | null {
  const scores = rows.filter(row => row.round === round);
  const mine = scores.find(row => row.user_id === userId);
  if (!mine || countableMatches < 1) return null;
  if (mine.hits === countableMatches) return -3;
  const ascending = [...new Set(scores.map(row => Number(row.hits)))].sort((a,b) => a-b);
  const rank = ascending.indexOf(Number(mine.hits));
  return rank === 0 ? 2 : rank === 1 ? 1 : 0;
}
