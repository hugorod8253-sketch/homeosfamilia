"use client";
import { useEffect,useState } from "react";

type InstallEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:"accepted"|"dismissed"}>};

export default function PwaRegister(){
 const [prompt,setPrompt]=useState<InstallEvent|null>(null);
 const [show,setShow]=useState(false);
 const [iosHelp,setIosHelp]=useState(false);

 useEffect(()=>{
  if("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(()=>{});
  const standalone=window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone===true;
  if(standalone)return;
  const dismissed=localStorage.getItem("homeos:pwa-install-dismissed")==="1";
  const onPrompt=(e:Event)=>{e.preventDefault();setPrompt(e as InstallEvent);if(!dismissed)setShow(true)};
  window.addEventListener("beforeinstallprompt",onPrompt);
  const isIos=/iphone|ipad|ipod/i.test(navigator.userAgent);
  const timer=window.setTimeout(()=>{if(!dismissed&&isIos)setShow(true)},1800);
  return ()=>{window.removeEventListener("beforeinstallprompt",onPrompt);window.clearTimeout(timer)};
 },[]);

 async function install(){
  if(prompt){
   await prompt.prompt();
   const choice=await prompt.userChoice;
   if(choice.outcome==="accepted"){setShow(false);setPrompt(null)}
   return;
  }
  setIosHelp(true);
 }
 function dismiss(){
  localStorage.setItem("homeos:pwa-install-dismissed","1");
  setShow(false);setIosHelp(false);
 }
 if(!show&&!iosHelp)return null;
 return <>
  {show&&<div className="pwa-install-chip"><div><strong>Instalar HomeOS</strong><small>Úsala como una app desde la pantalla de inicio.</small></div><button onClick={install}>Instalar</button><button className="pwa-close" onClick={dismiss} aria-label="Cerrar">×</button></div>}
  {iosHelp&&<div className="pwa-help-backdrop" onMouseDown={()=>setIosHelp(false)}><div className="pwa-help" onMouseDown={e=>e.stopPropagation()}><button className="pwa-help-close" onClick={()=>setIosHelp(false)}>×</button><strong>Instalar HomeOS en iPhone</strong><p>En Safari, toca <b>Compartir</b> y después <b>Añadir a pantalla de inicio</b>. Se abrirá sin la barra del navegador, como una app.</p><button className="primary" onClick={dismiss}>Entendido</button></div></div>}
 </>;
}
