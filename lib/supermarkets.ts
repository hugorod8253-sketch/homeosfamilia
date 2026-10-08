import {normalizeProductText} from './product-engine';
export const SPANISH_SUPERMARKETS=['Mercadona','Lidl','Aldi','Carrefour','Alcampo','Dia','Consum','BonÀrea','Bonpreu','Esclat','Bonpreu / Esclat','Caprabo','Eroski','Condis','Ametller Origen','Hipercor','Supercor','Ahorramás','Gadis','Froiz','BM','Covirán','Spar','HiperDino','Carnicería','Frutería','Otro supermercado'];
export function editDistance(a:string,b:string){
 let row=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){const next=[i];for(let j=1;j<=b.length;j++)next[j]=Math.min(next[j-1]+1,row[j]+1,row[j-1]+(a[i-1]===b[j-1]?0:1));row=next}return row[b.length];
}
export function normalizeSupermarket(value:string){
 const name=value.trim().replace(/\s+/g,' '),key=normalizeProductText(name);
 const aliases:Record<string,string>={ldl:'Lidl',lid:'Lidl',lild:'Lidl',bonaria:'BonÀrea',bonarea:'BonÀrea',bonare:'BonÀrea',meradona:'Mercadona',mercdona:'Mercadona'};
 if(aliases[key])return aliases[key];
 const exact=SPANISH_SUPERMARKETS.find(x=>normalizeProductText(x)===key);if(exact)return exact;
 const near=SPANISH_SUPERMARKETS.map(x=>({x,d:editDistance(normalizeProductText(x),key)})).sort((a,b)=>a.d-b.d);
 if(key.length>=4&&near[0].d<=(key.length>=7?2:1)&&near[0].d<near[1].d)return near[0].x;
 return name.charAt(0).toUpperCase()+name.slice(1);
}
