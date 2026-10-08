"use client";
import { useEffect } from "react";

/** Keep keyboard focus inside the open dialog and return it to its trigger on close. */
export default function DialogAccessibility(){
 useEffect(()=>{
  let active:HTMLElement|null=null;
  let previous:HTMLElement|null=null;
  let lastOutside=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const rememberFocus=(event:FocusEvent)=>{if(event.target instanceof HTMLElement&&!event.target.closest(".modal-backdrop"))lastOutside=event.target};
  const controls=(dialog:HTMLElement)=>Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')).filter(el=>el.getClientRects().length>0);
  const update=()=>{
   const backdrops=Array.from(document.querySelectorAll<HTMLElement>(".modal-backdrop")).filter(el=>el.getClientRects().length>0);
   const backdrop=backdrops.at(-1);
   const dialog=backdrop?(backdrop.querySelector<HTMLElement>(".modal")||backdrop.firstElementChild as HTMLElement):null;
   if(dialog===active)return;
   if(!dialog){active=null;if(previous?.isConnected)previous.focus();previous=null;return}
   previous=document.activeElement instanceof HTMLElement&&!dialog.contains(document.activeElement)?document.activeElement:lastOutside;
   active=dialog;
   dialog.setAttribute("role","dialog");dialog.setAttribute("aria-modal","true");dialog.tabIndex=-1;
   if(!dialog.hasAttribute("aria-label")&&!dialog.hasAttribute("aria-labelledby"))dialog.setAttribute("aria-label",dialog.querySelector("h2,h3")?.textContent||"Ventana de HomeOS");
   if(!dialog.contains(document.activeElement))(controls(dialog)[0]||dialog).focus();
  };
  const keydown=(event:KeyboardEvent)=>{
   if(!active)return;
   if(event.key==="Escape"){
    const close=active.querySelector<HTMLButtonElement>(".modal-head button");
    if(close){event.preventDefault();close.click()}
   }
   if(event.key!=="Tab")return;
   const items=controls(active),first=items[0],last=items.at(-1);
   if(!first){event.preventDefault();active.focus();return}
   if(event.shiftKey&&(document.activeElement===first||document.activeElement===active||!active.contains(document.activeElement))){event.preventDefault();last?.focus()}
   else if(!event.shiftKey&&(document.activeElement===last||!active.contains(document.activeElement))){event.preventDefault();first.focus()}
  };
  const observer=new MutationObserver(update);observer.observe(document.body,{childList:true,subtree:true});
  document.addEventListener("keydown",keydown);document.addEventListener("focusin",rememberFocus);update();
  return()=>{observer.disconnect();document.removeEventListener("keydown",keydown);document.removeEventListener("focusin",rememberFocus)};
 },[]);
 return null;
}
