"use client";
import {useState} from "react";

const members=[
 {team:"Derio A",coach:"Nando Alonso",delegate:"Gabri Alzueta"},
 {team:"Derio B",coach:"Gorka Barrio",delegate:"Mikel Elejalde"},
 {team:"Derio Fem",coach:"Iker Ibarluzea",delegate:"Omar El Kabouri"},
 {team:"Derio Fem B",coach:"Ibai Mateos",delegate:"Aner Taranilla"},
 {team:"Juvenil A",coach:"Peio Garcia",delegate:"Koldo Corral"},
 {team:"Juvenil B",coach:"Mikel Taranilla",delegate:"Asel Ibañez"},
];
const games=[["Derio A","Leioa"],["Derio B","Sestao"],["Derio Fem","Athletic B"],["Derio Fem B","Getxo"],["Juvenil A","Santutxu"],["Juvenil B","Zamudio"]];

export default function Home(){
 const [selected,setSelected]=useState<string|null>(null);
 if(!selected)return <main><header><div><b className="logo">Quini<span>Derio</span></b><small>La quiniela del CD Derio</small></div></header><section className="hero"><div><p className="eyebrow">BIENVENIDO</p><h1>¿Quién eres?</h1><p>Selecciona tu nombre para entrar. Tu equipo y tu rol quedarán asociados automáticamente.</p></div></section><section className="members">{members.map(m=><article className="member" key={m.team}><h3>{m.team}</h3><button onClick={()=>setSelected(m.coach)}><span><small>ENTRENADOR</small><b>{m.coach}</b></span><strong>›</strong></button><button onClick={()=>setSelected(m.delegate)}><span><small>DELEGADO</small><b>{m.delegate}</b></span><strong>›</strong></button></article>)}</section></main>;
 return <main><header><div><b className="logo">Quini<span>Derio</span></b><small>Todos los Derio. Una quiniela.</small></div><div className="avatar">{selected[0]}</div></header><section className="hero"><div><p className="eyebrow">JORNADA 4 · ABIERTA</p><h1>Haz tu quiniela</h1><p>Hola, {selected}. Pronostica los partidos del club antes del cierre.</p></div><div className="score"><strong>0/6</strong><small>pronósticos</small></div></section><div className="title"><h2>Partidos</h2><span>1 · X · 2</span></div><section className="games">{games.map((g,i)=><article className="game" key={g[0]}><div className="team"><i>{i+1}</i><div><b>{g[0]}</b><small>vs {g[1]}</small></div></div><div className="picks"><button>1</button><button>X</button><button>2</button></div></article>)}</section><button className="submit">Guardar quiniela</button><nav><b>⌂<small>Inicio</small></b><b>✓<small>Quiniela</small></b><b>▥<small>Clasificación</small></b><b>•••<small>Más</small></b></nav></main>
}