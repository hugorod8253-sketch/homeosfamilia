"use client";
import React from "react";
import { classifyProduct } from "../lib/product-engine";

const E:Record<string,string>={
 "tomato":"🍅","tomato-cherry":"🍅","carrot":"🥕","onion":"🧅","garlic":"🧄","potato":"🥔","sweet-potato":"🍠","avocado":"🥑",
 "banana":"🍌","apple":"🍎","pear":"🍐","orange":"🍊","tangerine":"🍊","lemon":"🍋","strawberry":"🍓","blueberry":"🫐","berries":"🫐","grapes":"🍇","pineapple":"🍍","mango":"🥭","kiwi":"🥝","melon":"🍈","watermelon":"🍉","peach":"🍑","papaya":"🥭","passion-fruit":"🟣","pomegranate":"🔴","lychee":"🩷","coconut":"🥥","dragon-fruit":"🐉",
 "eggplant":"🍆","pepper":"🌶️","mushroom":"🍄","broccoli":"🥦","cauliflower":"🥦","cucumber":"🥒","zucchini":"🥒",
 "chicken-leg":"🍗","bacon":"🥓","fish":"🐟","white-fish":"🐟","salmon":"🐟","shrimp":"🍤","shellfish":"🦪","egg":"🥚",
 "cheese":"🧀","butter":"🧈","bread":"🍞","baguette":"🥖","croissant":"🥐","rice":"🍚","pasta":"🍝","salt":"🧂","olive-oil":"🫒",
 "lentils":"🫘","chickpeas":"🫘","beans":"🫘","nuts":"🥜","pizza":"🍕","pizza-frozen":"🍕","salad":"🥗","sushi":"🍣","sandwich":"🥪",
 "cookie":"🍪","candy":"🍬","ice-cream":"🍨","water":"💧","juice":"🧃","soda":"🥤","energy-drink":"⚡","coffee":"☕","beer":"🍺","wine":"🍷",
 "toilet-paper":"🧻","kitchen-roll":"🧻","napkins":"🍽️","trash-bags":"🗑️","vitamins":"💊","fresh-cheese":"🧀","cheese-slices":"🧀","cheese-shredded":"🧀",
 "milk-bottle":"🥛","milk-carton":"🥛","kefir":"🥛","cream":"🥛","hummus":"🫘","guacamole":"🥑","tuna-can":"🥫","tomato-can":"🥫","can":"🥫",
 "cereal-box":"🥣","dark-chocolate":"🍫","milk-chocolate":"🍫","chocolate":"🍫","chips":"🥔","drink":"🥤","snack":"🍪","pantry":"🥫","unknown":"📦","prepared":"🍱","frozen":"🧊","frozen-vegetables":"🧊","frozen-fish":"❄️","dairy":"🥛","meat":"🥩","leafy":"🥬","spinach":"🥬","body-lotion":"🧴","face-cream":"🫙","sunscreen":"☀️"
};

function Svg({children,label}:{children:React.ReactNode;label?:string}){
 return <svg className="product-svg" viewBox="0 0 24 24" role={label?"img":"presentation"} aria-label={label} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
}
function custom(kind:string){
 switch(kind){
  case "lettuce":
  case "lettuce-iceberg":
  case "lettuce-romaine":
   return <Svg><path d="M5 17c-2-4 0-8 3-9 1-3 5-4 7-2 3 0 5 3 4 6 2 3 0 7-4 8H9c-2 0-3-1-4-3Z"/><path d="M8 17c2-5 4-7 8-9M11 19c0-4 2-7 6-9M7 13c3 0 5 1 7 4"/></Svg>;
  case "chicken-breast":
  case "chicken-tender":
   return <Svg><path d="M5 14c1-5 5-8 10-7 4 1 5 5 3 8-2 4-7 5-11 3-2-1-3-2-2-4Z"/><path d="M8 10c2-1 5-1 7 0"/></Svg>;
  case "turkey-breast":
  case "turkey-tender":
   return <Svg><path d="M4 14c1-4 4-7 8-7 5 0 8 3 7 7-1 4-5 6-10 5-3-1-5-2-5-5Z"/><path d="M7 12c3-2 6-2 9-1"/><path d="M8 15c3-1 5-1 8 0"/></Svg>;
  case "chicken-whole":
   return <Svg><path d="M7 8c3-3 8-2 10 1 2 3 1 7-2 9-3 2-8 1-10-2-2-3-1-6 2-8Z"/><path d="M16 7l2-2M18 6l2 1M7 17l-2 2"/></Svg>;
  case "steak":
  case "steak-thin":
  case "tenderloin":
  case "pork-loin":
  case "pork-tenderloin":
   return <Svg><path d="M4 13c0-5 5-9 10-8 4 1 7 4 6 8-1 5-6 7-11 6-3-1-5-3-5-6Z"/><path d="M9 11c1-2 5-2 6 0 1 2-1 4-3 4-3 0-4-2-3-4Z"/></Svg>;
  case "burger-patty":
   return <Svg><ellipse cx="12" cy="12" rx="8" ry="5"/><path d="M6 11c4 1 8 1 12 0M7 14c3 1 7 1 10 0"/></Svg>;
  case "ground-meat":
   return <Svg><path d="M5 8c2-2 4-2 6 0 2-2 4-2 6 0 2 2 1 4-1 5 2 2 0 5-2 5-2 0-3-1-4-2-2 2-5 1-5-2 0-1 1-2 2-3-2 0-3-2-2-3Z"/><path d="M9 9l6 6M15 9l-6 6"/></Svg>;
  case "ribs":
   return <Svg><path d="M6 6c3 2 9 2 12 0M7 9c3 2 7 2 10 0M8 12c2 2 6 2 8 0M9 15c2 2 4 2 6 0"/><path d="M6 5v12M18 5v12"/></Svg>;
  case "frankfurt":
  case "sausage-fresh":
  case "sausage-cured":
   return <Svg><path d="M6 16c-2-2-1-5 1-7l4-3c2-2 5-1 7 1s1 5-1 7l-4 3c-2 2-5 1-7-1Z"/><path d="M7 8l-2-2M19 15l-2-2"/></Svg>;
  case "ham-cured":
  case "ham-cooked":
  case "cured-loin":
   return <Svg><path d="M5 15c1-5 4-8 9-9 4 0 6 3 5 6-1 4-5 7-10 7-3 0-5-1-4-4Z"/><circle cx="15" cy="11" r="2"/></Svg>;
  case "tuna-steak":
   return <Svg><path d="M5 13c1-4 4-6 8-6 4 0 7 2 6 6-1 4-4 6-8 6s-7-2-6-6Z"/><path d="M8 10c3 2 5 4 7 7"/></Svg>;
  case "mozzarella-ball":
   return <Svg><circle cx="12" cy="12" r="7"/><path d="M8 9c2-2 6-2 8 0M9 15c2 1 4 1 6 0"/></Svg>;
  case "mozzarella-shredded":
   return <Svg><path d="M5 17l3-9 4 8 3-10 4 11"/><path d="M5 19h14"/></Svg>;
  case "yogurt":
   return <Svg><path d="M7 7h10l-1 12H8L7 7Z"/><path d="M6 7h12M9 4h6"/></Svg>;
  case "tofu":
   return <Svg><path d="M6 9l6-3 6 3v8l-6 3-6-3V9Z"/><path d="M6 9l6 3 6-3M12 12v8"/></Svg>;
  case "seitan":
   return <Svg><path d="M5 14c0-4 4-7 8-7 4 0 7 2 7 5 0 4-4 7-9 7-4 0-6-2-6-5Z"/><path d="M8 11c3 0 6 1 8 3M8 15c3-1 5-1 8 0"/></Svg>;
  case "tempeh":
   return <Svg><rect x="5" y="6" width="14" height="12" rx="2"/><circle cx="9" cy="10" r="1"/><circle cx="14" cy="9" r="1"/><circle cx="16" cy="14" r="1"/><circle cx="10" cy="15" r="1"/></Svg>;
  case "burger-bun":
   return <Svg><path d="M5 12c0-4 3-7 7-7s7 3 7 7H5Z"/><path d="M5 14h14M7 18h10c1 0 2-1 2-2H5c0 1 1 2 2 2Z"/><circle cx="9" cy="9" r=".4" fill="currentColor"/><circle cx="13" cy="8" r=".4" fill="currentColor"/></Svg>;
  case "sliced-bread":
   return <Svg><path d="M7 19V9C7 6 9 5 12 5s5 1 5 4v10H7Z"/><path d="M9 10c2-1 4-1 6 0"/></Svg>;
  case "oats":
   return <Svg><path d="M6 18c2-5 4-9 7-13M11 7c-2-1-3 0-3 2 2 1 3 0 3-2ZM14 10c2-1 3 0 3 2-2 1-3 0-3-2ZM9 13c-2-1-3 0-3 2 2 1 3 0 3-2Z"/></Svg>;
  case "flour":
   return <Svg><path d="M7 5h10l2 14H5L7 5Z"/><path d="M9 9h6M10 13h4"/></Svg>;
  case "sugar":
   return <Svg><path d="M7 5h10l2 14H5L7 5Z"/><path d="M9 12h6"/><path d="M11 9l1-2 1 2"/></Svg>;
  case "oil":
   return <Svg><path d="M10 4h4v3l2 3v9H8v-9l2-3V4Z"/><path d="M10 13h4"/></Svg>;
  case "frozen-fries":
   return <Svg><path d="M7 9h10l-1 10H8L7 9Z"/><path d="M8 9L7 4M11 9V3M14 9l1-5M17 9l1-4"/></Svg>;
  case "nuggets":
   return <Svg><path d="M6 10c1-3 4-4 6-2 2-2 5-1 6 1 1 3-1 5-3 5 0 3-3 5-6 3-3 0-4-4-2-6-1 0-1-1-1-1Z"/><circle cx="10" cy="11" r=".5" fill="currentColor"/><circle cx="14" cy="13" r=".5" fill="currentColor"/></Svg>;
  case "breaded-chicken":
   return <Svg><path d="M5 14c1-5 5-8 10-7 4 1 5 5 3 8-2 4-7 5-11 3-2-1-3-2-2-4Z"/><path d="M8 9l1 1M12 8l1 1M15 11l1 1M9 14l1 1M13 15l1 1"/></Svg>;
  case "croquette":
  case "croquette-frozen":
   return <Svg><rect x="5" y="8" width="14" height="8" rx="4"/><path d="M8 11h1M12 10h1M15 13h1" /></Svg>;
  case "lasagna":
  case "lasagna-frozen":
   return <Svg><rect x="5" y="6" width="14" height="12" rx="2"/><path d="M7 9c3-2 7 2 10 0M7 12c3-2 7 2 10 0M7 15c3-2 7 2 10 0"/></Svg>;
  case "tortilla":
   return <Svg><circle cx="12" cy="12" r="7"/><path d="M8 11c2-2 6-2 8 0M9 15c2 1 4 1 6 0"/></Svg>;
  case "protein-bar":
   return <Svg><rect x="4" y="8" width="16" height="8" rx="2"/><path d="M8 8v8M16 8v8"/><path d="M10 12h4"/></Svg>;
  case "chocolate-bar":
  case "milk-chocolate":
  case "dark-chocolate":
  case "chocolate":
   return <Svg><rect x="6" y="5" width="12" height="14" rx="1"/><path d="M10 5v14M14 5v14M6 10h12M6 15h12"/></Svg>;
  case "chocolate-almond":
   return <Svg><rect x="5" y="6" width="14" height="12" rx="1"/><path d="M9 6v12M14 6v12M5 12h14"/><ellipse cx="12" cy="9" rx="1.5" ry="2.5"/></Svg>;
  case "protein-tub":
   return <Svg><path d="M7 7h10l1 12H6L7 7Z"/><path d="M6 7h12M9 11h6M10 15h4"/></Svg>;
  case "creatine":
   return <Svg><path d="M8 6h8l1 13H7L8 6Z"/><path d="M9 10h6"/><circle cx="12" cy="14" r="2"/></Svg>;
  case "collagen":
   return <Svg><path d="M8 5h8l2 14H6L8 5Z"/><path d="M9 9c2 2 4 2 6 0M9 14c2-2 4-2 6 0"/></Svg>;
  case "preworkout":
   return <Svg><path d="M8 6h8l1 13H7L8 6Z"/><path d="M13 8l-3 5h3l-2 4 5-6h-3l2-3Z"/></Svg>;
  case "laundry-detergent":
   return <Svg><path d="M8 4h7l2 4v11H6V8l2-4Z"/><path d="M10 4v4h5M9 13h5"/></Svg>;
  case "fabric-softener":
   return <Svg><path d="M9 4h6l1 4 1 11H7L8 8l1-4Z"/><path d="M10 12c2-2 4-2 5 0-1 3-4 4-5 0Z"/></Svg>;
  case "bleach":
   return <Svg><path d="M9 4h6v3l2 2v10H7V9l2-2V4Z"/><path d="M10 13h4M12 10v6"/></Svg>;
  case "spray-cleaner":
   return <Svg><path d="M10 8h6l1 11H8L9 10l1-2Z"/><path d="M11 8V5h5M16 5l3 1M17 3l2-1"/></Svg>;
  case "dish-soap":
   return <Svg><path d="M10 4h4v4l2 2v9H8v-9l2-2V4Z"/><circle cx="12" cy="14" r="2"/></Svg>;
  case "dishwasher-tabs":
   return <Svg><rect x="5" y="5" width="14" height="14" rx="3"/><path d="M5 12h14M12 5v14"/></Svg>;
  case "shampoo":
   return <Svg><path d="M9 5h6v3l2 2v9H7v-9l2-2V5Z"/><path d="M10 14c1-2 3-2 4 0"/></Svg>;
  case "conditioner":
   return <Svg><path d="M8 6h8l1 13H7L8 6Z"/><path d="M10 11c2-2 4-2 4 0 0 2-2 3-4 4"/></Svg>;
  case "shower-gel":
   return <Svg><path d="M9 5h6v3l2 2v9H7v-9l2-2V5Z"/><path d="M12 11c2 2 2 4 0 5-2-1-2-3 0-5Z"/></Svg>;
  case "hand-soap":
   return <Svg><path d="M9 8h7l1 11H7L8 10l1-2Z"/><path d="M10 8V5h6M16 5v2"/><path d="M10 14c1-2 3-2 4 0"/></Svg>;
  case "deodorant":
   return <Svg><rect x="8" y="5" width="8" height="14" rx="2"/><path d="M9 8h6"/></Svg>;
  case "toothpaste":
   return <Svg><path d="M5 10l12-3 2 9-12 3-2-9Z"/><path d="M17 7l2-1 1 4-2 1"/></Svg>;
  case "perfume":
   return <Svg><rect x="7" y="8" width="10" height="11" rx="2"/><path d="M10 8V5h4v3M14 5l3-1"/><path d="M10 13c1-2 3-2 4 0"/></Svg>;
  default:return null;
 }
}

export function ProductGlyph({name,category,className=""}:{name:string;category?:string;className?:string}){
 const p=classifyProduct(name,category);
 const raw=name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
 const explicit=/verduras?|vegetales?|hortalizas?/.test(raw)?"🥦":/frutas?/.test(raw)?"🍎":/ensalada/.test(raw)?"🥗":/pollo/.test(raw)?"🍗":/pescado|merluza|salmon|atun/.test(raw)?"🐟":/carne/.test(raw)?"🥩":/arroz/.test(raw)?"🍚":/pasta/.test(raw)?"🍝":/pan/.test(raw)?"🍞":/queso/.test(raw)?"🧀":/huevo/.test(raw)?"🥚":"";
 const icon=explicit?null:custom(p.icon);
 const categorySlug=p.category.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-");
 const emoji=explicit||E[p.icon]||({Congelados:"🧊","Snacks y dulces":"🍪","Bebidas":"🥤","Higiene y cuidado":"🧴","Limpieza y hogar":"🧽",Suplementos:"💪",Preparados:"🍱",Carne:"🥩","Fruta y verdura":"🥬","Lácteos":"🥛",Despensa:"🥫","Por clasificar":"◌"} as Record<string,string>)[p.category]||"◌";
 return <span className={"product-glyph "+className+" glyph-"+categorySlug} title={p.canonical} aria-label={p.canonical}>{icon||emoji}</span>;
}
