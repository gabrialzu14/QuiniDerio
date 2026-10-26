/**
 * Identify the transition from Saturday to Sunday in a sorted fixture list.
 * UTC date-only arithmetic prevents daylight-saving and client timezone shifts.
 */
type WeekendFixture={date?:string;status?:string};
function validCalendarDate(input?:string):Date|null{
 const match=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((input||"").trim());
 if(!match)return null;
 const day=Number(match[1]),month=Number(match[2]),year=Number(match[3]);
 if(year<2000||year>2100)return null;
 const date=new Date(Date.UTC(year,month-1,day));
 return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day?date:null;
}
/** Index of the first Sunday fixture, or -1 when no Saturday/Sunday boundary exists. */
export function saturdaySundayBoundary(fixtures:readonly WeekendFixture[]):number{
 for(let i=1;i<fixtures.length;i++){
  const before=fixtures[i-1],after=fixtures[i];
  if(before.status==="rest"||after.status==="rest")continue;
  const saturday=validCalendarDate(before.date);
  const sunday=validCalendarDate(after.date);
  if(saturday?.getUTCDay()===6&&sunday?.getUTCDay()===0&&sunday.getTime()-saturday.getTime()===86400000)return i;
 }
 return -1;
}
