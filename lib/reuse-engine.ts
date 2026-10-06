export type ReuseNeed={key:string;label:string;amount:number;unit:"ud"|"g"|"ml"|"L"};
export type ReuseOutput={name:string;qty:number;unit:string;category:string;location:"Nevera"|"Congelador"|"Despensa"};
export type ReuseIdea={
 id:string;
 title:string;
 icon:string;
 kind:"aprovechar"|"transformar";
 summary:string;
 needs:ReuseNeed[];
 optional?:string[];
 steps:string[];
 output?:ReuseOutput;
 safety?:string;
 safetyLevel?:"normal"|"attention";
 tags:string[];
};

export const REUSE_IDEAS:ReuseIdea[]=[
 {
  id:"homemade-yogurt",
  title:"Yogur casero con leche y un yogur",
  icon:"🥛",
  kind:"transformar",
  summary:"Convierte leche segura y un yogur natural con cultivos vivos en una nueva tanda de yogur.",
  needs:[{key:"leche",label:"Leche pasteurizada o UHT",amount:1,unit:"L"},{key:"yogur natural",label:"Yogur natural con cultivos vivos",amount:1,unit:"ud"}],
  optional:["Leche en polvo para una textura más espesa","Colarlo después para un estilo más tipo griego"],
  steps:[
   "Usa leche correctamente conservada y dentro de una fecha segura. No uses leche con olor, sabor o aspecto alterado.",
   "Calienta la leche hasta aproximadamente 85–93 °C y mantenla caliente unos minutos.",
   "Deja bajar la temperatura hasta unos 44–46 °C.",
   "Mezcla una pequeña parte de la leche con el yogur y reincorpórala.",
   "Fermenta a temperatura controlada siguiendo una yogurtera o método fiable; como referencia, unas 4–8 horas.",
   "Refrigera inmediatamente cuando haya cuajado. Si quieres estilo griego, cuélalo después en frío."
  ],
  output:{name:"Yogur casero",qty:1000,unit:"g",category:"Lácteos",location:"Nevera"},
  safety:"No sirve para «rescatar» leche estropeada o pasada de fecha de caducidad. La fermentación requiere higiene y control de temperatura.",
  safetyLevel:"attention",
  tags:["leche","yogur","fermentacion","desperdicio"]
 },
 {
  id:"yogurt-sauce",
  title:"Salsa rápida de yogur",
  icon:"🥣",
  kind:"aprovechar",
  summary:"Una forma sencilla de gastar un yogur natural en una salsa para pollo, verduras, ensalada o wraps.",
  needs:[{key:"yogur",label:"Yogur natural",amount:1,unit:"ud"}],
  optional:["Limón","Ajo","Hierbas","Curry o comino"],
  steps:["Pon el yogur en un bol.","Añade limón o vinagre suave, especias y hierbas al gusto.","Mezcla y conserva refrigerado hasta usarlo."],
  output:{name:"Salsa de yogur",qty:4,unit:"raciones",category:"Preparados",location:"Nevera"},
  safety:"Mantén la salsa refrigerada y usa ingredientes que estén en buen estado.",
  safetyLevel:"normal",
  tags:["yogur","salsa","pollo","ensalada"]
 },
 {
  id:"banana-pancakes",
  title:"Tortitas de plátano y huevo",
  icon:"🍌",
  kind:"aprovechar",
  summary:"Ideal para plátanos muy maduros pero todavía sanos.",
  needs:[{key:"platano",label:"Plátanos",amount:2,unit:"ud"},{key:"huevo",label:"Huevos",amount:2,unit:"ud"}],
  optional:["Avena","Canela"],
  steps:["Machaca los plátanos.","Mézclalos con los huevos.","Añade avena si quieres más cuerpo.","Cocina porciones pequeñas en sartén."],
  output:{name:"Tortitas de plátano",qty:6,unit:"uds",category:"Preparados",location:"Nevera"},
  safety:"No uses fruta con moho o signos de podredumbre.",
  tags:["platano","huevo","desayuno"]
 },
 {
  id:"tomato-sauce",
  title:"Salsa de tomate para aprovechar tomates",
  icon:"🍅",
  kind:"transformar",
  summary:"Convierte tomates maduros en una base para pasta, arroz, pizza o guisos.",
  needs:[{key:"tomate",label:"Tomates",amount:4,unit:"ud"}],
  optional:["Cebolla","Ajo","Aceite de oliva","Hierbas"],
  steps:["Retira cualquier tomate deteriorado; usa solo los que estén sanos.","Trocea y cocina a fuego medio con aceite y, si quieres, cebolla o ajo.","Reduce hasta la textura que prefieras.","Enfría y guarda en nevera en un recipiente limpio."],
  output:{name:"Salsa de tomate casera",qty:4,unit:"raciones",category:"Preparados",location:"Nevera"},
  safety:"Cocinar no vuelve seguro un alimento que ya estaba estropeado.",
  tags:["tomate","salsa","pasta"]
 },
 {
  id:"vegetable-cream",
  title:"Crema de verduras de aprovechamiento",
  icon:"🥕",
  kind:"aprovechar",
  summary:"Agrupa pequeñas cantidades de verdura que conviene gastar y conviértelas en varias raciones.",
  needs:[{key:"verdura",label:"Verduras variadas",amount:3,unit:"ud"}],
  optional:["Patata","Cebolla","Caldo","Especias"],
  steps:["Selecciona verduras sanas y retira las partes no aprovechables.","Trocea y cuece o sofríe antes de añadir agua o caldo.","Tritura hasta obtener una crema.","Enfría rápido lo que no vayas a comer y refrigera o congela."],
  output:{name:"Crema de verduras",qty:4,unit:"raciones",category:"Preparados",location:"Nevera"},
  safety:"No uses verduras con podredumbre o moho extendido.",
  tags:["verdura","crema","mealprep"]
 },
 {
  id:"milk-pancakes",
  title:"Tortitas para gastar leche",
  icon:"🥞",
  kind:"aprovechar",
  summary:"Una salida rápida cuando queda bastante leche y quieres usarla antes.",
  needs:[{key:"leche",label:"Leche",amount:250,unit:"ml"},{key:"huevo",label:"Huevos",amount:2,unit:"ud"},{key:"harina",label:"Harina",amount:200,unit:"g"}],
  optional:["Canela","Fruta madura"],
  steps:["Mezcla leche y huevos.","Añade la harina poco a poco.","Cocina porciones en una sartén antiadherente.","Guarda las sobrantes refrigeradas."],
  output:{name:"Tortitas",qty:8,unit:"uds",category:"Preparados",location:"Nevera"},
  safety:"Usa leche correctamente conservada y no pasada de fecha de caducidad.",
  tags:["leche","huevo","harina","desayuno"]
 },
 {
  id:"fruit-compote",
  title:"Compota con fruta madura",
  icon:"🍎",
  kind:"transformar",
  summary:"Para fruta madura que sigue en buen estado y ya no apetece comer tal cual.",
  needs:[{key:"fruta",label:"Fruta madura",amount:3,unit:"ud"}],
  optional:["Canela","Limón"],
  steps:["Usa solo fruta sana; desecha piezas con moho o podredumbre.","Pela y trocea si hace falta.","Cocina a fuego suave con una pequeña cantidad de agua.","Enfría y refrigera."],
  output:{name:"Compota de fruta",qty:4,unit:"raciones",category:"Preparados",location:"Nevera"},
  safety:"No intentes aprovechar fruta deteriorada mediante cocción.",
  tags:["fruta","postre","desayuno"]
 },
 {
  id:"cheese-gratin",
  title:"Gratinado para gastar restos de queso",
  icon:"🧀",
  kind:"aprovechar",
  summary:"Usa pequeñas cantidades de queso sobre verduras, pasta o patata en vez de dejarlas olvidadas.",
  needs:[{key:"queso",label:"Queso",amount:80,unit:"g"}],
  optional:["Verduras","Pasta cocida","Patata"],
  steps:["Ralla o corta el queso.","Reparte sobre el plato que quieras aprovechar.","Gratina hasta que funda y dore.","Sirve inmediatamente."],
  safety:"Respeta el estado y conservación del queso; el calor no corrige un producto estropeado.",
  tags:["queso","gratinar","sobras"]
 }
];

export function reuseIdeaMatchesProduct(idea:ReuseIdea,name:string,category:string){
 const n=(name||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
 const c=(category||"").toLowerCase();
 return idea.needs.some(need=>{
  if(need.key==="verdura") return c.includes("fruta y verdura")&&!/platano|banana|manzana|pera|naranja|mandarina|fresa|uva|mango|kiwi|melon|sandia|pina|papaya/.test(n);
  if(need.key==="fruta") return c.includes("fruta y verdura")&&/platano|banana|manzana|pera|naranja|mandarina|fresa|uva|mango|kiwi|melon|sandia|pina|papaya|melocoton|ciruela|cereza/.test(n);
  return n.includes(need.key);
 });
}
