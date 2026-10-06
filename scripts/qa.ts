import { classifyProduct, detectProductsInText, freezerQualityGuide } from "../lib/product-engine";
import { parseReceiptText } from "../lib/receipt-local";
import { EXTRA_RECIPES } from "../lib/extra-recipes";
import { REUSE_IDEAS } from "../lib/reuse-engine";
import { estimateShelfLifeFromReference, LIDL_2026_SHELF_LIFE, shelfLifeBandFromReference, shelfLifeReferenceDays } from "../lib/shelf-life-calibration";
import { buildWeeklyMenu } from "../lib/weekly-menu";

function assert(condition:any,message:string){
 if(!condition)throw new Error("QA: "+message);
}
function product(name:string,category:string,location:string){
 const p=classifyProduct(name);
 assert(p.category===category,name+" category expected "+category+" got "+p.category);
 assert(p.location===location,name+" location expected "+location+" got "+p.location);
}

const cases:[string,string,string][]=[
 ["lechuga","Fruta y verdura","Nevera"],
 ["lechuga iceberg","Fruta y verdura","Nevera"],
 ["tomate cherry","Fruta y verdura","Nevera"],
 ["pechuga de pollo","Carne","Nevera"],
 ["pechuga de pavo","Carne","Nevera"],
 ["hamburguesa de vacuno","Carne","Nevera"],
 ["hamburguesa vegetal","Preparados","Nevera"],
 ["pan de hamburguesa","Despensa","Despensa"],
 ["entrecot","Carne","Nevera"],
 ["solomillo de cerdo","Carne","Nevera"],
 ["mozzarella rallada","Lácteos","Nevera"],
 ["burrata","Lácteos","Nevera"],
 ["queso brie","Lácteos","Nevera"],
 ["yogur griego","Lácteos","Nevera"],
 ["tofu","Preparados","Nevera"],
 ["seitán","Preparados","Nevera"],
 ["patatas fritas congeladas","Congelados","Congelador"],
 ["croquetas congeladas","Congelados","Congelador"],
 ["croquetas frescas","Preparados","Nevera"],
 ["pescado congelado","Congelados","Congelador"],
 ["pizza fresca","Preparados","Nevera"],
 ["pizza congelada","Congelados","Congelador"],
 ["tomate frito","Despensa","Despensa"],
 ["atún en lata","Despensa","Despensa"],
 ["leche fresca","Lácteos","Nevera"],
 ["leche condensada","Despensa","Despensa"],
 ["bebida de avena","Bebidas","Despensa"],
 ["kombucha","Bebidas","Nevera"],
 ["edamame","Congelados","Congelador"],
 ["soja texturizada","Despensa","Despensa"],
 ["detergente lavadora","Limpieza y hogar","Despensa"],
 ["suavizante","Limpieza y hogar","Despensa"],
 ["perfume","Higiene y cuidado","Despensa"],
 ["pasta de dientes","Higiene y cuidado","Despensa"],
 ["papel higiénico","Limpieza y hogar","Despensa"],
 ["creatina","Suplementos","Suplementos"],
 ["chocolate con leche","Snacks y dulces","Despensa"],
 ["chocolate con almendras","Snacks y dulces","Despensa"],
 ["kale","Fruta y verdura","Nevera"],
 ["pak choi","Fruta y verdura","Nevera"]
];
cases.forEach(([a,b,c])=>product(a,b,c));

const unknown=classifyProduct("producto marciano xyz");
assert(unknown.category==="Por clasificar","unknown product must not silently become pantry");
assert(unknown.location==="Sin ubicar","unknown product must remain unlocated");

const mentioned=detectProductsInText("Tengo leche y yogur natural y quiero aprovechar ambos");
assert(mentioned.some(x=>x.canonical.includes("leche")),"voice context should detect milk");
assert(mentioned.some(x=>x.canonical.includes("yogur")),"voice context should detect yogurt");

const burgerGuide=freezerQualityGuide("hamburguesa de vacuno","Carne","Hamburguesa");
assert(burgerGuide?.maxMonths===4,"burger freezer guide should exist");

const receipt=parseReceiptText([
 "MERCADONA",
 "LECHE SEMI 1L 1,05",
 "YOGUR NATURAL 1,75",
 "2 X PLATANO 3,20",
 "TOTAL 6,00",
 "TARJETA 6,00"
].join("\n"));
assert(receipt.total===6,"receipt total should parse");
assert(receipt.items.length===3,"receipt should parse 3 product lines");
assert(receipt.items.some(x=>x.name.toLowerCase().includes("leche")),"receipt should include milk");
assert(receipt.items.some(x=>x.qty===2),"receipt should parse x2 quantity");

assert(EXTRA_RECIPES.length>=30,"local recipe book should have at least 30 extra recipes");
assert(REUSE_IDEAS.length>=8,"reuse library should have at least 8 verified ideas");
assert(EXTRA_RECIPES.some(r=>r.ingredients.some(i=>/yogur/i.test(i.name))&&r.ingredients.some(i=>/leche/i.test(i.name))),"recipe book should cover milk + yogurt together");
assert(LIDL_2026_SHELF_LIFE.length>=50,"real Lidl shelf-life calibration should contain at least 50 observed references");
assert(shelfLifeBandFromReference("pan de hamburguesa")==="corta","burger buns should calibrate as short shelf life");
assert(shelfLifeBandFromReference("macarrones")==="larga","dry pasta should calibrate as long shelf life");
assert((shelfLifeReferenceDays("bebida de avena barista")||0)>150,"barista oat drink should use observed long shelf-life reference");
assert(LIDL_2026_SHELF_LIFE.some(x=>x.name==="batido proteínas"&&x.label==="02/2028"),"protein drink must preserve the observed 02/2028 label");
assert(LIDL_2026_SHELF_LIFE.some(x=>x.name==="queso"&&x.exactDate==="2026-11-19"),"cheese must preserve the corrected 19/11/2026 label");
assert(LIDL_2026_SHELF_LIFE.some(x=>x.name==="almendras"&&x.confidence==="media"&&!x.exactDate),"almonds 29/03 must remain incomplete instead of inventing a year");
const oatEstimate=estimateShelfLifeFromReference("bebida de avena barista","2026-10-06");
assert(oatEstimate?.date==="2027-05-02","estimated oat drink date should reproduce the observed reference on the observation date");
assert(oatEstimate?.kind==="preferente","estimated oat drink must remain a best-before estimate, not an expiry guarantee");


const menu=buildWeeklyMenu(EXTRA_RECIPES,{
 inventory:["pechuga de pollo","arroz","tomate","yogur natural","patatas","huevos","garbanzos"],
 dislikes:["queso azul"],
 tools:["Placa / inducción","Horno","Air fryer"],
 people:4
});
assert(menu.slots.length===14,"weekly menu should create lunch and dinner for 7 days");
assert(new Set(menu.slots.map(x=>x.day)).size===7,"weekly menu should cover all 7 days");
assert(menu.slots.filter(x=>x.meal==="Comida").length===7,"weekly menu should include 7 lunches");
assert(menu.slots.filter(x=>x.meal==="Cena").length===7,"weekly menu should include 7 dinners");


console.log("HomeOS QA passed:",cases.length,"product classifications,",EXTRA_RECIPES.length,"extra recipes,",REUSE_IDEAS.length,"reuse ideas,",LIDL_2026_SHELF_LIFE.length,"shelf-life samples, weekly menu 14/14");
