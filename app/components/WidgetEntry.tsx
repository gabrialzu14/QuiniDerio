"use client";
import {useEffect,useState} from "react";
import "./widget-entry.css";
export type WidgetMode="compact"|"full";
declare global{
 interface Window{
  QuiniWidgets?:{supportsWidgets:()=>boolean;addWidget:(mode:WidgetMode)=>void};
  webkit?:{messageHandlers?:{quiniWidgets?:{postMessage:(value:{mode:WidgetMode})=>void}}};
 }
}
export function widgetPlatform():"android"|"ios"|null{
 if(typeof window==="undefined")return null;
 try{if(window.QuiniWidgets?.supportsWidgets())return "android"}catch{}
 if(window.webkit?.messageHandlers?.quiniWidgets)return "ios";
 return null;
}
export default function WidgetEntry(){
 const [available,setAvailable]=useState(false);
 useEffect(()=>{setAvailable(!!widgetPlatform())},[]);
 if(!available)return null;
 return <a className="qdWidgetEntry" href="/widgets">Widget de jornada <span>Elige jornada completa o partido a partido →</span></a>;
}
