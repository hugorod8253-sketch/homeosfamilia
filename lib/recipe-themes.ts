import type {RecipeEntry} from "./extra-recipes";
export const RECIPE_THEMES=[
 {id:"sushi",icon:"🍣",title:"Japón: sushi en casa",description:"Maki vegetal y rellenos cocinados, paso a paso.",pattern:/maki|sushi|temaki/},
 {id:"pasta",icon:"🍝",title:"Pasta italiana",description:"Desde una carbonara sencilla hasta pasta con pesto.",pattern:/pasta|carbonara|espagueti|macarron/},
 {id:"pizza",icon:"🍕",title:"Noche de pizza",description:"Bases, verduras y rellenos para variar.",pattern:/pizza/},
 {id:"burger",icon:"🍔",title:"Hamburguesas al estilo americano",description:"Carne, pollo y opciones vegetales para tu hamburguesa.",pattern:/hamburguesa/}
] as const;
export function themeForMonth(date=new Date()){return RECIPE_THEMES[date.getMonth()%RECIPE_THEMES.length]}
export function themeRecipes<T extends Pick<RecipeEntry,"title">>(id:string,recipes:T[],date=new Date()){
 const theme=RECIPE_THEMES.find(t=>t.id===id);if(!theme)return [];
 const matches=recipes.filter(r=>theme.pattern.test(r.title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")));
 const week=Math.floor((date.getDate()-1)/7),offset=matches.length?week*3%matches.length:0;
 return [...matches.slice(offset),...matches.slice(0,offset)].slice(0,6);
}
