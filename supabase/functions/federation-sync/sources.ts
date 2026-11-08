/** Where each QuiniDerio team plays: federation website, competition, group and agrupación codes. */
export type TeamSource={t:string,o:string,c:string,g:string,a:string};
export const EUSKADI="https://www.euskadifutbol.eus",BIZKAIA="https://www.fvf-bff.eus";
export const TEAM_SOURCES:TeamSource[]=[
 {t:"Derio A",o:EUSKADI,c:"24057857",g:"24057858",a:"1"},
 {t:"Derio Fem",o:EUSKADI,c:"24057866",g:"24057867",a:"1"},
 {t:"Derio B",o:BIZKAIA,c:"24058476",g:"24109682",a:"1773563"},
 {t:"Derio Fem B",o:BIZKAIA,c:"24058462",g:"24265685",a:"1773567"},
 {t:"Juvenil A",o:BIZKAIA,c:"24058479",g:"24153519",a:"1773564"},
 {t:"Juvenil B",o:BIZKAIA,c:"24058483",g:"24155723",a:"1773564"},
 {t:"Cadete B",o:BIZKAIA,c:"24058487",g:"24190893",a:"1773565"},
];
export const calendarUrl=(s:TeamSource,j:number)=>`${s.o}/pnfg/NPcd/NFG_CmpJornada?cod_primaria=1000120&CodCompeticion=${s.c}&CodGrupo=${s.g}&CodTemporada=22&CodJornada=${j}&Sch_Tipo_Juego=1&cod_agrupacion=${s.a}`;
export const standingsUrl=(s:TeamSource,j:number)=>`${s.o}/pnfg/NPcd/NFG_VisClasificacion?cod_primaria=1000120&codjornada=${j}&codcompeticion=${s.c}&codgrupo=${s.g}&cod_agrupacion=${s.a}`;
