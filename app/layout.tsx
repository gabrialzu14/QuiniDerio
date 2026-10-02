import "./globals.css";
import {Inter} from "next/font/google";
const inter=Inter({subsets:["latin"],variable:"--font-inter",display:"swap"});
const appIcon="https://bwonxnayayopbohxuphs.supabase.co/storage/v1/object/public/Images/branding/LogoApp.png";
export const metadata={
 title:"QuiniDerio",
 description:"La quiniela de los equipos del CD Derio",
 manifest:"/manifest.webmanifest",
 icons:{icon:[{url:appIcon,type:"image/png"}],shortcut:appIcon,apple:[{url:appIcon,type:"image/png"}]}
};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es" suppressHydrationWarning><head><style dangerouslySetInnerHTML={{__html:`html,body{margin:0;min-height:100%;background:#07131f}body:before{content:"";position:fixed;inset:0;z-index:2147483646;pointer-events:none;background:radial-gradient(circle at 50% 42%,#102d48 0,#07131f 38%,#03080e 76%)}body.qd-mounted:before{display:none}`}}/><link rel="preconnect" href="https://bwonxnayayopbohxuphs.supabase.co" crossOrigin="anonymous"/><link rel="dns-prefetch" href="https://bwonxnayayopbohxuphs.supabase.co"/><script dangerouslySetInnerHTML={{__html:`try{var t=localStorage.getItem("quiniderio-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`}}/><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no"/><meta name="theme-color" content="#070b14"/></head><body className={inter.variable}>{children}</body></html>}
