"use client";
import {useEffect,useState} from "react";

/** Profile photo that falls back to the initial when missing or when the image fails to load. */
export default function AvatarImage({src,name,lazy=false}:{src?:string|null,name?:string|null,lazy?:boolean}){
 const [failed,setFailed]=useState(false);
 useEffect(()=>setFailed(false),[src]);
 const initial=(name||"").trim()[0]?.toUpperCase()||"?";
 if(!src||failed)return <>{initial}</>;
 return <img src={src} alt={name||""} loading={lazy?"lazy":undefined} decoding="async" onError={()=>setFailed(true)}/>;
}
