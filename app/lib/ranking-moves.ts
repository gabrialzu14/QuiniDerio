export type RankingRow={user_id:string,hits:number|string|null};
export type RoundScore={user_id:string,round:number|string,hits:number|string|null};

/**
 * Places gained (+) or lost (-) in the general ranking since before the
 * latest scored jornada. `rows` is the ranking exactly as shown; ties keep
 * that same order in the previous standings, so tied players never "move"
 * between themselves. Returns an empty map when there is no earlier jornada.
 */
export function rankingMoves(rows:RankingRow[],scores:RoundScore[]):Map<string,number>{
 const moves=new Map<string,number>();
 if(!rows.length||!scores.length)return moves;
 const last=Math.max(...scores.map(s=>Number(s.round)).filter(Number.isFinite));
 if(!scores.some(s=>Number(s.round)<last))return moves;
 const before=new Map<string,number>();
 for(const s of scores)if(Number(s.round)<last)before.set(s.user_id,(before.get(s.user_id)||0)+Number(s.hits||0));
 const shown=new Map(rows.map((row,index)=>[row.user_id,index]));
 const previous=[...rows].sort((a,b)=>(before.get(b.user_id)||0)-(before.get(a.user_id)||0)||(shown.get(a.user_id)!-shown.get(b.user_id)!));
 previous.forEach((row,index)=>moves.set(row.user_id,index-shown.get(row.user_id)!));
 return moves;
}
