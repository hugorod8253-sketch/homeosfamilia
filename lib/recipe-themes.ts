import type {RecipeEntry} from "./extra-recipes";
export const RECIPE_THEMES=[
 {id:"sushi",icon:"🇯🇵",title:"Japón",description:"Maki, uramaki, yakisoba, sopa de miso y cocina casera."},
 {id:"china",icon:"🇨🇳",title:"China",description:"Mapo tofu, kung pao, chow mein y sopa wonton."},
 {id:"korea",icon:"🇰🇷",title:"Corea",description:"Bibimbap, japchae, tteokbokki, pajeon y bulgogi."},
 {id:"thailand",icon:"🇹🇭",title:"Tailandia",description:"Pad thai, tom kha, satay y ensaladas aromáticas."},
 {id:"germany",icon:"🇩🇪",title:"Alemania",description:"Schnitzel, spätzle, flammkuchen y sopa de lentejas."},
 {id:"mexico",icon:"🇲🇽",title:"México",description:"Tacos de pescado, enchiladas, chilaquiles y sopa de tortilla."},
 {id:"india",icon:"🇮🇳",title:"India",description:"Dal, chana masala, palak paneer, aloo gobi y pakoras."},
 {id:"spain",icon:"🇪🇸",title:"España",description:"Salmorejo, croquetas, pan con tomate, pisto y marmitako."},
 {id:"pasta",icon:"🇮🇹",title:"Italia",description:"Risotto, minestrone, lasaña, bruschetta y pasta."},
 {id:"pizza",icon:"🍕",title:"Noche de pizza",description:"Seis pizzas con ingredientes y fotografías propios."},
 {id:"burger",icon:"🇺🇸",title:"Estados Unidos",description:"Hamburguesas, mac and cheese, alitas, sloppy joe y brownie."},
 {id:"france",icon:"🇫🇷",title:"Francia",description:"Ratatouille, quiche, sopa de cebolla, crêpes y croque monsieur."},
 {id:"netherlands",icon:"🇳🇱",title:"Países Bajos",description:"Stamppot, hutspot, erwtensoep, poffertjes y bitterballen."},
 {id:"greece",icon:"🇬🇷",title:"Grecia",description:"Gyros, spanakopita, fasolada, tzatziki y ensalada griega."},
 {id:"portugal",icon:"🇵🇹",title:"Portugal",description:"Bacalhau à Brás, caldo verde, bifana, francesinha y pastéis de nata."},
 {id:"morocco",icon:"🇲🇦",title:"Marruecos",description:"Tajín, cuscús, harira, kefta, zaalouk y taktouka."}
] as const;
const originals:Record<string,string>={x07:"spain",x13:"spain",x26:"china",x03:"india",x19:"mexico",x01:"pasta",x02:"pasta",r1:"burger",x34:"burger",x20:"pizza"};
const monthly=["spain","france","india","greece","mexico","thailand","china","germany","sushi","pizza","morocco","portugal"];
export function themeForMonth(date=new Date()){return RECIPE_THEMES.find(t=>t.id===monthly[date.getMonth()])!}
export function themeForPeriod(period:"week"|"month",date=new Date()){
 if(period==="month")return themeForMonth(date);
 const monday=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));
 monday.setUTCDate(monday.getUTCDate()-(monday.getUTCDay()+6)%7);
 const week=Math.floor((monday.getTime()-Date.UTC(2020,0,6))/604800000);
 return RECIPE_THEMES[((week%RECIPE_THEMES.length)+RECIPE_THEMES.length)%RECIPE_THEMES.length];
}
export function themeRecipes<T extends Pick<RecipeEntry,"id"|"title"|"image"> & Partial<Pick<RecipeEntry,"country"|"family">>>(id:string,recipes:T[],date=new Date()){
 if(!RECIPE_THEMES.some(t=>t.id===id))return [];
 const families=new Set<string>(),photos=new Set<string>();
 const matches=recipes.filter(r=>{if((r.country||originals[r.id])!==id)return false;const family=r.family||r.id;if(families.has(family)||photos.has(r.image))return false;families.add(family);photos.add(r.image);return true});
 const offset=matches.length?Math.floor((date.getDate()-1)/7)%matches.length:0;
 return [...matches.slice(offset),...matches.slice(0,offset)];
}
