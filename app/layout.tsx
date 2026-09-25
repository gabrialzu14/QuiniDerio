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
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es"><head><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no"/><meta name="theme-color" content="#070b14"/></head><body className={inter.variable}>{children}</body></html>}
