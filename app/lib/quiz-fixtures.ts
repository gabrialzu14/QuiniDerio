export type Fixture={name:string,opponent?:string,status?:string,date?:string,time?:string,venue?:string,isHome?:boolean,federationRound?:number,competition?:string,crest?:string,derioPosition?:number,opponentPosition?:number};
const confirmedFixtures:Record<string,Partial<Fixture>>={
 "Derio A":{opponent:"Beasain",date:"04/10/2026",time:"18:30",venue:"Ibaiondo, Derio",isHome:true,competition:"3ª RFEF",federationRound:5},
 "Derio B":{opponent:"Escolapios",date:"03/10/2026",time:"18:30",venue:"Ibaiondo, Derio",isHome:true,competition:"Derio B",federationRound:3},
 "Derio Fem":{opponent:"Lakua",date:"03/10/2026",time:"18:15",venue:"Sansomendi, Vitoria-Gasteiz",isHome:false,competition:"FEM Liga Vasca",federationRound:3},
 "Derio Fem B":{opponent:"Ibaiondo Nerbioi A",date:"03/10/2026",time:"20:00",venue:"PL Rekalde, Bilbao",isHome:false,federationRound:1,competition:"FEM B"},
 "Juvenil A":{opponent:"Iturrigorri A",date:"04/10/2026",time:"13:30",venue:"La Roseta, Bilbao",isHome:false,federationRound:3,competition:"Juvenil A"},
 "Juvenil B":{opponent:"Leioa D",date:"04/10/2026",time:"15:30",venue:"Ibaiondo, Derio",isHome:true,federationRound:1,competition:"Juvenil B"},
 "Cadete B":{status:"rest",competition:"Cadete B",federationRound:1}
};
export const quizFixtures:Record<number,Record<string,Partial<Fixture>>>={
 1:{
  "Derio A":confirmedFixtures["Derio A"],
  "Derio B":confirmedFixtures["Derio B"],
  "Derio Fem":confirmedFixtures["Derio Fem"],
  "Derio Fem B":confirmedFixtures["Derio Fem B"],
  "Juvenil A":confirmedFixtures["Juvenil A"],
  "Juvenil B":confirmedFixtures["Juvenil B"],
  "Cadete B":confirmedFixtures["Cadete B"]
 },
 2:{
  "Derio A":{opponent:"Cultural Durango",date:"10/10/2026",time:"12:00",venue:"Tabira, Durango",isHome:false,competition:"3ª RFEF",crest:"/api/assets/Escudos/CulturalDurango.webp"},
  "Derio B":{opponent:"Zamudio B",date:"12/10/2026",time:"18:00",venue:"Errekalde, Zamudio",isHome:false,competition:"Derio B",crest:"/api/assets/Escudos/Zamudio.webp"},
  "Derio Fem":{opponent:"Erandioko Betiko Neskak",date:"11/10/2026",time:"17:30",venue:"Ibaiondo, Derio",isHome:true,competition:"FEM Liga Vasca",crest:"/api/assets/Escudos/BetikoNeskak.webp"},
  "Derio Fem B":{opponent:"Montefuerte A",date:"10/10/2026",time:"17:00",venue:"Ibaiondo, Derio",isHome:true,competition:"FEM B",crest:"/api/assets/Escudos/Montefuerte.webp"},
  "Juvenil A":{opponent:"Ariz A",date:"11/10/2026",time:"20:00",venue:"Ibaiondo, Derio",isHome:true,competition:"Juvenil A",crest:"/api/assets/Escudos/Ariz.webp"},
  "Juvenil B":{opponent:"Neguri",date:"10/10/2026",time:"16:00",venue:"Bolue 2, Getxo",isHome:false,competition:"Juvenil B",crest:"/api/assets/Escudos/Neguri.webp"},
  "Cadete B":{opponent:"Gaztelueta B",date:"10/10/2026",time:"12:15",venue:"Gaztelueta, Leioa",isHome:false,competition:"Cadete B",crest:"/api/assets/Escudos/Gaztelueta.webp"}
 },
3:{
  "Derio A":{opponent:"Touring",crest:"/api/assets/Escudos/touring.webp",date:"17/10/2026",time:"16:30",venue:"Fanderia, Errenteria",isHome:false,competition:"3ª RFEF",derioPosition:3,opponentPosition:9},
  "Derio B":{opponent:"Bermeo B",crest:"/api/assets/Escudos/bermeo.webp",date:"18/10/2026",time:"15:15",venue:"Ibaiondo, Derio",isHome:true,competition:"Derio B",derioPosition:15,opponentPosition:9},
  "Derio Fem":{opponent:"Zumaiako",crest:"/api/assets/Escudos/zumaiako.webp",date:"17/10/2026",time:"15:00",venue:"Aita Mari, Zumaia",isHome:false,competition:"FEM Liga Vasca",derioPosition:10,opponentPosition:8},
  "Derio Fem B":{opponent:"Balmaseda",crest:"/api/assets/Escudos/balmaseda.webp",date:"18/10/2026",time:"17:40",venue:"Ibaiondo, Derio",isHome:true,competition:"FEM B",derioPosition:5,opponentPosition:5},
  "Juvenil A":{opponent:"Artibai A",crest:"/api/assets/Escudos/artibai.webp",date:"17/10/2026",time:"20:00",venue:"Ibaiondo, Derio",isHome:true,competition:"Juvenil A",derioPosition:9,opponentPosition:14},
  "Juvenil B":{opponent:"Askartza B",crest:"/api/assets/Escudos/askartza.webp",date:"18/10/2026",time:"20:00",venue:"Ibaiondo, Derio",isHome:true,competition:"Juvenil B",derioPosition:3,opponentPosition:11},
  "Cadete B":{opponent:"Ugeraga B",crest:"/api/assets/Escudos/ugeraga%20.webp?v=20261013-supabase",date:"18/10/2026",time:"13:00",venue:"Ibaiondo, Derio",isHome:true,competition:"Cadete B",derioPosition:12,opponentPosition:7}
 }
};


/** A jornada becomes available once its fixtures are published in the app. */
export function publishedQuiniRounds():number[]{
 return Object.entries(quizFixtures)
  .filter(([,fixtures])=>Object.values(fixtures).some(f=>f.status!=="rest"&&!!f.opponent?.trim()&&!!f.date&&!!f.time))
  .map(([round])=>Number(round)).sort((a,b)=>a-b);
}

/** Stable publication signature: new/revised fixtures trigger a one-time DB sync in each browser. */
export function publishedFixtureSignature():string{
 return publishedQuiniRounds().map(round=>[round,Object.entries(quizFixtures[round])
  .filter(([,f])=>f.status!=="rest"&&!!f.opponent?.trim()&&!!f.date&&!!f.time)
  .map(([team,f])=>[team,f.opponent,f.isHome,f.date,f.time].join(":")).join("|")].join(":")).join(";");
}
