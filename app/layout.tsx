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
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es" suppressHydrationWarning><head><style dangerouslySetInnerHTML={{__html:`html,body{margin:0;min-height:100%;background:radial-gradient(circle at 12% 8%,#7a1830 0,transparent 32%),radial-gradient(circle at 88% 12%,#153f86 0,transparent 34%),linear-gradient(180deg,#0b1730,#07101d 58%,#0a1424);color-scheme:dark}body:before{content:"";position:fixed;inset:0;z-index:2147483646;pointer-events:none;background:linear-gradient(135deg,#0b1730,#07101d 55%,#0c1830) url("/launch.svg?v=3") center center/cover no-repeat;opacity:1;transition:opacity .18s ease-out}body.qd-mounted:before{opacity:0}`}}/><link rel="apple-touch-startup-image" href="/launch.svg?v=3"/><link rel="preload" href="/launch.svg?v=3" as="image"/><link rel="preconnect" href="https://bwonxnayayopbohxuphs.supabase.co" crossOrigin="anonymous"/><link rel="dns-prefetch" href="https://bwonxnayayopbohxuphs.supabase.co"/><script dangerouslySetInnerHTML={{__html:`try{var t=localStorage.getItem("quiniderio-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`}}/><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no"/><meta name="theme-color" content="#0b1730"/><meta name="color-scheme" content="dark"/><meta name="apple-mobile-web-app-capable" content="yes"/><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/></head><body className={inter.variable}>{children}</body></html>}
