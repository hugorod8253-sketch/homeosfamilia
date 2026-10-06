import type { Metadata, Viewport } from "next";
import "./globals.css";
import PwaRegister from "../components/pwa-register";

export const metadata: Metadata = {
  title: "HomeOS · Tu hogar, en orden",
  description: "Decide qué comer, qué comprar y controla gasto y desperdicio sin llevar una contabilidad manual de la cocina.",
  applicationName: "HomeOS",
  manifest: "/manifest.webmanifest",
  appleWebApp:{capable:true,statusBarStyle:"default",title:"HomeOS"},
  icons:{icon:"/icon.svg?v=2",apple:"/apple-icon"},
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f7f8f4",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}<PwaRegister/></body></html>;
}
