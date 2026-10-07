import type {RecipeEntry} from "./extra-recipes";
export const RECIPE_THEMES=[
 {id:"sushi",icon:"🇯🇵",title:"Japón",description:"Maki y platos caseros de inspiración japonesa.",pattern:/maki|sushi|temaki|teriyaki/},
 {id:"china",icon:"🇨🇳",title:"China",description:"Salteados rápidos con soja y jengibre.",pattern:/estilo chino/},
 {id:"korea",icon:"🇰🇷",title:"Corea",description:"Boles y salteados inspirados en la cocina coreana.",pattern:/estilo coreano/},
 {id:"thailand",icon:"🇹🇭",title:"Tailandia",description:"Curry de coco y sabores aromáticos para cocinar en casa.",pattern:/estilo tailandes/},
 {id:"germany",icon:"🇩🇪",title:"Alemania",description:"Frankfurt, patatas y mostaza en versiones sencillas.",pattern:/frankfurt/},
 {id:"mexico",icon:"🇲🇽",title:"México",description:"Tacos, quesadillas y fajitas de inspiración mexicana.",pattern:/taco|quesadilla|fajita/},
 {id:"india",icon:"🇮🇳",title:"India",description:"Currys suaves con verduras, legumbres y especias.",pattern:/curry/},
 {id:"spain",icon:"🇪🇸",title:"España",description:"Revueltos, tortillas y platos sencillos para compartir.",pattern:/revuelto|tortilla de|pisto/},
 {id:"pasta",icon:"🇮🇹",title:"Italia: pasta italiana",description:"Desde una carbonara sencilla hasta pasta con pesto.",pattern:/pasta|carbonara|espagueti|macarron/},
 {id:"pizza",icon:"🍕",title:"Noche de pizza",description:"Bases, verduras y rellenos para variar.",pattern:/pizza/},
 {id:"burger",icon:"🇺🇸",title:"Estados Unidos: hamburguesas",description:"Carne, pollo y opciones vegetales para tu hamburguesa.",pattern:/hamburguesa/}
] as const;
export function themeForMonth(date=new Date()){return RECIPE_THEMES[date.getMonth()%RECIPE_THEMES.length]}
export function themeForPeriod(period:"week"|"month",date=new Date()){
 if(period==="month")return themeForMonth(date);
 const monday=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));
 monday.setUTCDate(monday.getUTCDate()-(monday.getUTCDay()+6)%7);
 return RECIPE_THEMES[Math.floor((monday.getTime()-Date.UTC(2020,0,6))/604800000)%RECIPE_THEMES.length];
}
export function themeRecipes<T extends Pick<RecipeEntry,"title">>(id:string,recipes:T[],date=new Date()){
 const theme=RECIPE_THEMES.find(t=>t.id===id);if(!theme)return [];
 const matches=recipes.filter(r=>theme.pattern.test(r.title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")));
 const week=Math.floor((date.getDate()-1)/7),offset=matches.length?week*3%matches.length:0;
 return [...matches.slice(offset),...matches.slice(0,offset)].slice(0,6);
}
