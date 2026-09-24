import "./globals.css";
import {Inter} from "next/font/google";
const inter=Inter({subsets:["latin"],variable:"--font-inter",display:"swap"});
export const metadata={title:"QuiniDerio",description:"La quiniela de los equipos del CD Derio",icons:{icon:"/quiniderio-logo.jpg",apple:"/quiniderio-logo.jpg"}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es"><head><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no"/></head><body className={inter.variable}>{children}</body></html>}