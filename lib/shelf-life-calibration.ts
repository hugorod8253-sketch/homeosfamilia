export type ShelfLifeSample={
 name:string;
 observedAt:string;
 label:string;
 kind:"caducidad"|"preferente"|"desconocido";
 confidence:"alta"|"media"|"dudosa";
 exactDate?:string;
 monthYear?:string;
 note?:string;
};

/* Muestra real observada en Lidl el 06/10/2026.
   No sustituye la fecha del envase comprado por el usuario: solo calibra
   rangos iniciales y evita estimaciones absurdas cuando todavía no hay etiqueta. */
export const LIDL_2026_SHELF_LIFE:ShelfLifeSample[]=[
 {name:"caldo de pollo",observedAt:"2026-10-06",label:"26/10/2027",kind:"preferente",confidence:"alta",exactDate:"2027-10-26"},
 {name:"bebida de avena barista",observedAt:"2026-10-06",label:"02/05/2027",kind:"preferente",confidence:"alta",exactDate:"2027-05-02"},
 {name:"arroz basmati",observedAt:"2026-10-06",label:"11/2027",kind:"preferente",confidence:"alta",monthYear:"2027-11"},
 {name:"arroz largo",observedAt:"2026-10-06",label:"11/2027",kind:"preferente",confidence:"alta",monthYear:"2027-11"},
 {name:"macarrones",observedAt:"2026-10-06",label:"08/2029",kind:"preferente",confidence:"alta",monthYear:"2029-08"},
 {name:"espaguetis",observedAt:"2026-10-06",label:"07/2029",kind:"preferente",confidence:"alta",monthYear:"2029-07"},
 {name:"lentejas cocidas bote",observedAt:"2026-10-06",label:"12/2031",kind:"preferente",confidence:"alta",monthYear:"2031-12"},
 {name:"garbanzos conserva",observedAt:"2026-10-06",label:"31/12/2031",kind:"preferente",confidence:"alta",exactDate:"2031-12-31"},
 {name:"alubias",observedAt:"2026-10-06",label:"11/03/2028",kind:"preferente",confidence:"alta",exactDate:"2028-03-11"},
 {name:"lentejas secas",observedAt:"2026-10-06",label:"17/03/2028",kind:"preferente",confidence:"alta",exactDate:"2028-03-17"},
 {name:"mayonesa",observedAt:"2026-10-06",label:"07/2027",kind:"preferente",confidence:"alta",monthYear:"2027-07"},
 {name:"ketchup",observedAt:"2026-10-06",label:"01/2028",kind:"preferente",confidence:"alta",monthYear:"2028-01"},
 {name:"piña en lata",observedAt:"2026-10-06",label:"28/10/2027",kind:"preferente",confidence:"alta",exactDate:"2027-10-28"},
 {name:"champiñones en lata",observedAt:"2026-10-06",label:"31/12/2029",kind:"preferente",confidence:"alta",exactDate:"2029-12-31"},
 {name:"maíz conserva",observedAt:"2026-10-06",label:"07/2029",kind:"preferente",confidence:"alta",monthYear:"2029-07"},
 {name:"tinto para cocinar",observedAt:"2026-10-06",label:"1/6",kind:"desconocido",confidence:"dudosa",note:"Dato incompleto/dudoso; no usar para cálculo."},
 {name:"Vinoucosus",observedAt:"2026-10-06",label:"sin fecha visible",kind:"desconocido",confidence:"dudosa"},
 {name:"atún conserva",observedAt:"2026-10-06",label:"31/09/2029",kind:"preferente",confidence:"dudosa",note:"Fecha transcrita imposible; no usar para cálculo."},
 {name:"almendras",observedAt:"2026-10-06",label:"29/03",kind:"preferente",confidence:"media",note:"Año no indicado en la recogida; no usar para cálculo."},
 {name:"mix frutos secos natural",observedAt:"2026-10-06",label:"18/01/2027",kind:"preferente",confidence:"alta",exactDate:"2027-01-18"},
 {name:"chocolate negro",observedAt:"2026-10-06",label:"13/07/2028",kind:"preferente",confidence:"alta",exactDate:"2028-07-13"},
 {name:"kit kat",observedAt:"2026-10-06",label:"04/2027",kind:"preferente",confidence:"alta",monthYear:"2027-04"},
 {name:"bombones",observedAt:"2026-10-06",label:"04/2027",kind:"preferente",confidence:"alta",monthYear:"2027-04"},
 {name:"chuches",observedAt:"2026-10-06",label:"07/05/2028",kind:"preferente",confidence:"alta",exactDate:"2028-05-07"},
 {name:"bizcocho de coco",observedAt:"2026-10-06",label:"03/11/2026",kind:"preferente",confidence:"alta",exactDate:"2026-11-03",note:"Año corregido en la recogida 2016→2026."},
 {name:"magdalenas",observedAt:"2026-10-06",label:"16/11/2026",kind:"preferente",confidence:"alta",exactDate:"2026-11-16"},
 {name:"sobaos",observedAt:"2026-10-06",label:"24/11/2026",kind:"preferente",confidence:"alta",exactDate:"2026-11-24"},
 {name:"magdalenas azúcar",observedAt:"2026-10-06",label:"07/11/2026",kind:"preferente",confidence:"alta",exactDate:"2026-11-07"},
 {name:"chocoguayquis",observedAt:"2026-10-06",label:"23/11/2026",kind:"preferente",confidence:"alta",exactDate:"2026-11-23"},
 {name:"mermelada",observedAt:"2026-10-06",label:"07/2029",kind:"preferente",confidence:"alta",monthYear:"2029-07"},
 {name:"nutella",observedAt:"2026-10-06",label:"20/07/2027",kind:"preferente",confidence:"alta",exactDate:"2027-07-20"},
 {name:"miel",observedAt:"2026-10-06",label:"19/02/2028",kind:"preferente",confidence:"alta",exactDate:"2028-02-19"},
 {name:"galletas maría",observedAt:"2026-10-06",label:"28/07/2027",kind:"preferente",confidence:"alta",exactDate:"2027-07-28"},
 {name:"tortitas de arroz",observedAt:"2026-10-06",label:"09/07/2027",kind:"preferente",confidence:"alta",exactDate:"2027-07-09"},
 {name:"corn flakes",observedAt:"2026-10-06",label:"08/2027",kind:"preferente",confidence:"alta",monthYear:"2027-08"},
 {name:"muesli",observedAt:"2026-10-06",label:"06/07/2027",kind:"preferente",confidence:"alta",exactDate:"2027-07-06"},
 {name:"harina",observedAt:"2026-10-06",label:"08/09/2027",kind:"preferente",confidence:"alta",exactDate:"2027-09-08"},
 {name:"panela",observedAt:"2026-10-06",label:"08/2031",kind:"preferente",confidence:"alta",monthYear:"2031-08"},
 {name:"gotas de chocolate",observedAt:"2026-10-06",label:"07/2028",kind:"preferente",confidence:"alta",monthYear:"2028-07"},
 {name:"levadura",observedAt:"2026-10-06",label:"11/2028",kind:"preferente",confidence:"alta",monthYear:"2028-11"},
 {name:"producto infantil",observedAt:"2026-10-06",label:"07/2027",kind:"preferente",confidence:"media",monthYear:"2027-07"},
 {name:"café molido",observedAt:"2026-10-06",label:"23/12/2027",kind:"preferente",confidence:"alta",exactDate:"2027-12-23"},
 {name:"batido proteínas",observedAt:"2026-10-06",label:"02/2028",kind:"preferente",confidence:"alta",monthYear:"2028-02"},
 {name:"barritas energéticas",observedAt:"2026-10-06",label:"07/2027",kind:"preferente",confidence:"alta",monthYear:"2027-07"},
 {name:"cola cao",observedAt:"2026-10-06",label:"15/06/2029",kind:"preferente",confidence:"alta",exactDate:"2029-06-15"},
 {name:"té frutos rojos",observedAt:"2026-10-06",label:"08/2028",kind:"preferente",confidence:"alta",monthYear:"2028-08"},
 {name:"pan blanco molde",observedAt:"2026-10-06",label:"13/10/2026",kind:"preferente",confidence:"alta",exactDate:"2026-10-13"},
 {name:"brioche hamburguesa",observedAt:"2026-10-06",label:"30/10/2026",kind:"preferente",confidence:"alta",exactDate:"2026-10-30"},
 {name:"tortillas trigo",observedAt:"2026-10-06",label:"02/02/2027",kind:"preferente",confidence:"alta",exactDate:"2027-02-02"},
 {name:"pan hot dog",observedAt:"2026-10-06",label:"17/10/2026",kind:"preferente",confidence:"alta",exactDate:"2026-10-17"},
 {name:"tostadas integrales",observedAt:"2026-10-06",label:"08/2027",kind:"preferente",confidence:"alta",monthYear:"2027-08"},
 {name:"huevos",observedAt:"2026-10-06",label:"25/10",kind:"preferente",confidence:"media",note:"Año no indicado; referencia de octubre de 2026."},
 {name:"fuet",observedAt:"2026-10-06",label:"01/11/2026",kind:"preferente",confidence:"alta",exactDate:"2026-11-01"},
 {name:"jamón serrano",observedAt:"2026-10-06",label:"14/01/2027",kind:"preferente",confidence:"alta",exactDate:"2027-01-14"},
 {name:"pipas",observedAt:"2026-10-06",label:"04/08/2027",kind:"preferente",confidence:"alta",exactDate:"2027-08-04"},
 {name:"pistachos",observedAt:"2026-10-06",label:"19/04/2027",kind:"preferente",confidence:"alta",exactDate:"2027-04-19"},
 {name:"zanahoria envasada",observedAt:"2026-10-06",label:"sin fecha recogida",kind:"desconocido",confidence:"dudosa"},
 {name:"butifarra",observedAt:"2026-10-06",label:"17/10/2026",kind:"caducidad",confidence:"alta",exactDate:"2026-10-17"},
 {name:"ganchitos / cheetos",observedAt:"2026-10-06",label:"23/12",kind:"preferente",confidence:"media",note:"Año no indicado."},
 {name:"zumo",observedAt:"2026-10-06",label:"28/07/2027",kind:"preferente",confidence:"alta",exactDate:"2027-07-28"},
 {name:"cerveza",observedAt:"2026-10-06",label:"06/2027",kind:"preferente",confidence:"alta",monthYear:"2027-06"},
 {name:"queso",observedAt:"2026-10-06",label:"19/11/2026",kind:"preferente",confidence:"alta",exactDate:"2026-11-19"},
 {name:"ice tea limón",observedAt:"2026-10-06",label:"28/08/2027",kind:"preferente",confidence:"alta",exactDate:"2027-08-28"},
 {name:"patatas chips",observedAt:"2026-10-06",label:"18/11/2026",kind:"preferente",confidence:"alta",exactDate:"2026-11-18"}
];

function norm(s:string){return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9ñ\s]/g," ").replace(/\s+/g," ").trim()}
function daysBetween(a:string,b:string){return Math.round((new Date(b+"T12:00:00").getTime()-new Date(a+"T12:00:00").getTime())/86400000)}
function monthMid(monthYear:string){
 const [y,m]=monthYear.split("-").map(Number);
 return new Date(y,m-1,15,12).toISOString().slice(0,10);
}

export function shelfLifeSample(name:string){
 const n=norm(name);
 const aliases=[
  {test:(x:string)=>/pan.*hamburguesa|brioche.*hamburguesa/.test(x),keys:["brioche hamburguesa"]},
  {test:(x:string)=>/bebida.*avena.*barista|leche.*avena.*barista/.test(x),keys:["bebida de avena barista"]},
  {test:(x:string)=>/maiz|blat de moro/.test(x),keys:["maiz conserva"]},
  {test:(x:string)=>/atun.*(lata|conserva)/.test(x),keys:["atun conserva"]}
 ];
 const alias=aliases.find(a=>a.test(n));
 const matches=LIDL_2026_SHELF_LIFE.filter(s=>{
  const k=norm(s.name);
  return n===k||n.includes(k)||Boolean(alias?.keys.some(x=>k===x));
 }).sort((a,b)=>norm(b.name).length-norm(a.name).length);
 return matches[0]||null;
}

export function shelfLifeReferenceDays(name:string){
 const s=shelfLifeSample(name);
 if(!s||s.confidence==="dudosa")return null;
 const target=s.exactDate||(s.monthYear?monthMid(s.monthYear):"");
 if(!target)return null;
 const days=daysBetween(s.observedAt,target);
 return days>0?days:null;
}

export function shelfLifeBandFromReference(name:string):"corta"|"media"|"larga"|null{
 const days=shelfLifeReferenceDays(name);
 if(days==null)return null;
 if(days<=45)return "corta";
 if(days<=180)return "media";
 return "larga";
}

export function estimateShelfLifeFromReference(name:string,purchasedAt:string){
 const sample=shelfLifeSample(name);
 const days=shelfLifeReferenceDays(name);
 if(!sample||days==null||sample.confidence==="dudosa")return null;
 const base=new Date(purchasedAt+"T12:00:00");
 if(Number.isNaN(base.getTime()))return null;
 base.setDate(base.getDate()+days);
 return {
  date:base.toISOString().slice(0,10),
  kind:sample.kind==="caducidad"?"caducidad" as const:"preferente" as const,
  confidence:sample.confidence,
  basis:"Estimación orientativa basada en una referencia real observada en tienda; manda siempre la fecha del envase."
 };
}
