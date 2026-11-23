/** Escudo del Derio. A partir de la jornada 9 se usa la versión con contorno blanco fino. */
export const DERIO_CREST="/api/assets/Escudos/cd_derio.png";
export const DERIO_CREST_OUTLINED="/escudos/derio-contorno-v1.webp";
export const DERIO_OUTLINE_FROM_ROUND=9;
export const derioCrestFor=(round:number)=>Number.isFinite(round)&&round>=DERIO_OUTLINE_FROM_ROUND?DERIO_CREST_OUTLINED:DERIO_CREST;
