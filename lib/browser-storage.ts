export function readBrowserStorage(key:string){
 try{return typeof window!=="undefined"?window.localStorage.getItem(key):null}catch{return null}
}
export function writeBrowserStorage(key:string,value:string){
 try{if(typeof window==="undefined")return false;window.localStorage.setItem(key,value);return true}catch{return false}
}
export function removeBrowserStorage(key:string){
 try{if(typeof window!=="undefined")window.localStorage.removeItem(key);return true}catch{return false}
}
