import { PRODUCT_VARIETIES, findProductVariety } from "./product-varieties";
export type ProductLocation="Nevera"|"Congelador"|"Despensa"|"Suplementos"|"Sin ubicar";
export type ProductRotation="alta"|"media"|"baja";
export type ProductSafety="cold-required"|"frozen"|"shelf"|"household"|"supplement"|"flex"|"unknown";
export type ProductProfile={
 canonical:string;
 category:string;
 subcategory:string;
 location:ProductLocation;
 rotation:ProductRotation;
 icon:string;
 safety:ProductSafety;
};

/** Suggestions for short or ambiguous names typed by the shopper. */
export function productSuggestions(name:string):ProductProfile[]{
 const n=normalizeProductText(name);
 const out:ProductProfile[]=[];
 const add=(x:string)=>{const p=classifyProduct(x);if(!out.some(y=>y.canonical===p.canonical))out.push(p)};
 if(/\bpavo\b/.test(n)){add("pechuga de pavo");add("solomillo de pavo");add("pavo en lonchas");}
 if(/\bpollo\b/.test(n)&&!/(caldo|sopa|croqueta|nugget|asado)/.test(n)){add("pechuga de pollo");add("solomillo de pollo");add("pollo entero");}
 if(/entrecot|argentino/.test(n)){add("entrecot de vacuno");}
 if(/\bcarne\b/.test(n)){add("carne picada");add("filete de ternera");add("entrecot de vacuno");}
 if(out.length===0&&n.length>=3)for(const v of PRODUCT_VARIETIES.filter(v=>normalizeProductText(v.name).startsWith(n)).slice(0,8))add(v.name);
 return out;
}

export function normalizeProductText(value:string){
 return (value||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9ñ\s]/g," ").replace(/\s+/g," ").trim();
}

type Rule=ProductProfile&{match:RegExp};

const P=(canonical:string,match:RegExp,category:string,subcategory:string,location:ProductLocation,rotation:ProductRotation,icon:string,safety:ProductSafety):Rule=>({canonical,match,category,subcategory,location,rotation,icon,safety});

const RULES:Rule[]=[
 // Verdura y hortaliza — específicos antes de genéricos
 P("lechuga iceberg",/lechuga\s+iceberg|iceberg/,"Fruta y verdura","Verdura","Nevera","alta","lettuce-iceberg","flex"),
 P("lechuga romana",/lechuga\s+romana|romana/,"Fruta y verdura","Verdura","Nevera","alta","lettuce-romaine","flex"),
 P("lechuga",/lechuga|cogollo|batavia|trocadero|lollo|escarola/,"Fruta y verdura","Verdura","Nevera","alta","lettuce","flex"),
 P("canónigos",/canonigo/,"Fruta y verdura","Verdura","Nevera","alta","leafy","flex"),
 P("rúcula",/rucula/,"Fruta y verdura","Verdura","Nevera","alta","leafy","flex"),
 P("espinacas",/espinaca/,"Fruta y verdura","Verdura","Nevera","alta","spinach","flex"),
 P("brócoli",/brocoli/,"Fruta y verdura","Verdura","Nevera","alta","broccoli","flex"),
 P("coliflor",/coliflor/,"Fruta y verdura","Verdura","Nevera","alta","cauliflower","flex"),
 P("tomate cherry",/tomate\s+cherry|cherry/,"Fruta y verdura","Verdura","Nevera","alta","tomato-cherry","flex"),
 P("tomate",/tomate(?!\s*(frito|triturado|conserva|lata|cherry))/,"Fruta y verdura","Verdura","Nevera","alta","tomato","flex"),
 P("pepino",/pepino/,"Fruta y verdura","Verdura","Nevera","alta","cucumber","flex"),
 P("calabacín",/calabacin/,"Fruta y verdura","Verdura","Nevera","alta","zucchini","flex"),
 P("berenjena",/berenjena/,"Fruta y verdura","Verdura","Nevera","alta","eggplant","flex"),
 P("pimiento",/pimiento/,"Fruta y verdura","Verdura","Nevera","alta","pepper","flex"),
 P("zanahoria",/zanahoria/,"Fruta y verdura","Verdura","Nevera","media","carrot","flex"),
 P("cebolla",/cebolla/,"Fruta y verdura","Verdura","Despensa","media","onion","flex"),
 P("ajo",/\bajo\b|ajos/,"Fruta y verdura","Verdura","Despensa","baja","garlic","flex"),
 P("patata",/patata(?!s?\s*(frita|congelada|de\s+bolsa|chips))/,"Fruta y verdura","Verdura","Despensa","media","potato","flex"),
 P("boniato",/boniato|batata/,"Fruta y verdura","Verdura","Despensa","media","sweet-potato","flex"),
 P("aguacate",/aguacate/,"Fruta y verdura","Fruta","Despensa","alta","avocado","flex"),
 P("champiñón",/champinon|seta/,"Fruta y verdura","Verdura","Nevera","alta","mushroom","flex"),

 P("verduras variadas",/^verduras?(?:\s+variadas?)?$/,"Fruta y verdura","Verdura","Nevera","alta","leafy","flex"),
 // Frutas
 P("fruta",/^frutas?(?:\s+(?:variadas?|de\s+temporada))?$/,"Fruta y verdura","Fruta","Nevera","alta","apple","flex"),
 P("plátano",/platano|banana/,"Fruta y verdura","Fruta","Despensa","alta","banana","flex"),
 P("manzana",/manzana/,"Fruta y verdura","Fruta","Nevera","media","apple","flex"),
 P("pera",/\bpera\b|peras/,"Fruta y verdura","Fruta","Nevera","media","pear","flex"),
 P("naranja",/naranja/,"Fruta y verdura","Fruta","Despensa","media","orange","flex"),
 P("mandarina",/mandarina|clementina/,"Fruta y verdura","Fruta","Despensa","media","tangerine","flex"),
 P("limón",/limon/,"Fruta y verdura","Fruta","Nevera","media","lemon","flex"),
 P("fresas",/fresa/,"Fruta y verdura","Fruta","Nevera","alta","strawberry","flex"),
 P("arándanos",/arandano/,"Fruta y verdura","Fruta","Nevera","alta","blueberry","flex"),
 P("frambuesas",/frambuesa/,"Fruta y verdura","Fruta","Nevera","alta","berries","flex"),
 P("uvas",/\buva|uvas/,"Fruta y verdura","Fruta","Nevera","alta","grapes","flex"),
 P("piña",/pina/,"Fruta y verdura","Fruta","Nevera","media","pineapple","flex"),
 P("mango",/mango/,"Fruta y verdura","Fruta","Despensa","media","mango","flex"),
 P("kiwi",/kiwi/,"Fruta y verdura","Fruta","Nevera","media","kiwi","flex"),
 P("melón",/melon/,"Fruta y verdura","Fruta","Despensa","media","melon","flex"),
 P("sandía",/sandia/,"Fruta y verdura","Fruta","Despensa","media","watermelon","flex"),
 P("melocotón",/melocoton|nectarina/,"Fruta y verdura","Fruta","Nevera","media","peach","flex"),
 P("fruta del dragón",/fruta\s+del\s+dragon|pitahaya/,"Fruta y verdura","Fruta","Nevera","media","dragon-fruit","flex"),
 P("papaya",/papaya/,"Fruta y verdura","Fruta","Nevera","media","papaya","flex"),
 P("maracuyá",/maracuya|fruta\s+de\s+la\s+pasion/,"Fruta y verdura","Fruta","Nevera","media","passion-fruit","flex"),
 P("granada",/granada/,"Fruta y verdura","Fruta","Nevera","media","pomegranate","flex"),
 P("lichi",/lichi|lychee/,"Fruta y verdura","Fruta","Nevera","alta","lychee","flex"),
 P("coco",/\bcoco\b/,"Fruta y verdura","Fruta","Despensa","baja","coconut","flex"),

 // Carne y aves
 P("pechuga de pollo",/(?!.*(?:rebozad|empanad|kentucky|congelad))(?:pechuga.*pollo|filete.*pollo)/,"Carne","Pollo","Nevera","alta","chicken-breast","cold-required"),
 P("pechuga de pavo",/(?!.*(?:rebozad|empanad|congelad))(?:pechuga.*pavo|filete.*pavo)/,"Carne","Pavo","Nevera","alta","turkey-breast","cold-required"),
 P("pavo",/^pavo$/,"Carne","Pavo","Nevera","alta","turkey-breast","cold-required"),
 P("pechuga",/^pechuga$/,"Carne","Aves · por concretar","Nevera","alta","chicken-breast","cold-required"),
 P("solomillo de pollo",/(?!.*(?:rebozad|empanad|kentucky|congelad))solomillo.*pollo/,"Carne","Pollo","Nevera","alta","chicken-tender","cold-required"),
 P("solomillo de pavo",/solomillo.*pavo/,"Carne","Pavo","Nevera","alta","turkey-tender","cold-required"),
 P("pavo en lonchas",/pavo.*loncha|loncha.*pavo/,"Carne","Embutido","Nevera","media","ham-cooked","cold-required"),
 P("muslo de pollo",/muslo.*pollo|contramuslo|cuarto\s+trasero.*pollo/,"Carne","Pollo","Nevera","alta","chicken-leg","cold-required"),
 P("pollo entero",/pollo\s+entero/,"Carne","Pollo","Nevera","alta","chicken-whole","cold-required"),
 P("pollo",/^pollo$/,"Carne","Pollo","Nevera","alta","chicken-breast","cold-required"),
 P("entrecot de vacuno",/entrecot/,"Carne","Vacuno","Nevera","alta","steak","cold-required"),
 P("solomillo de vacuno",/solomillo.*(vacuno|ternera)|solomillo$|solomillo\s+de\s+ternera/,"Carne","Vacuno","Nevera","alta","tenderloin","cold-required"),
 P("filete de ternera",/filete.*ternera|ternera.*filete/,"Carne","Vacuno","Nevera","alta","steak-thin","cold-required"),
 P("carne picada",/carne\s+picada|picada\s+(vacuno|cerdo|mixta)/,"Carne","Carne picada","Nevera","alta","ground-meat","cold-required"),
 P("hamburguesa de carne",/hamburguesa|burger\s+meat|burger(?!\s+pan)/,"Carne","Hamburguesa","Nevera","alta","burger-patty","cold-required"),
 P("lomo de cerdo",/lomo.*cerdo|cinta\s+de\s+lomo|chuleta.*lomo/,"Carne","Cerdo","Nevera","alta","pork-loin","cold-required"),
 P("solomillo de cerdo",/solomillo.*cerdo/,"Carne","Cerdo","Nevera","alta","pork-tenderloin","cold-required"),
 P("costillas",/costilla/,"Carne","Cerdo","Nevera","alta","ribs","cold-required"),
 P("secreto de cerdo",/secreto.*cerdo|secreto\s+iberico/,"Carne","Cerdo","Nevera","alta","steak","cold-required"),
 P("presa ibérica",/presa.*iberic/,"Carne","Cerdo","Nevera","alta","steak","cold-required"),
 P("pluma ibérica",/pluma.*iberic/,"Carne","Cerdo","Nevera","alta","steak-thin","cold-required"),
 P("cordero",/cordero|chuleta.*cordero|paletilla.*cordero/,"Carne","Cordero","Nevera","alta","steak","cold-required"),
 P("bacon",/bacon|panceta/,"Carne","Embutido","Nevera","media","bacon","cold-required"),
 P("jamón serrano",/jamon\s+serrano|jamon\s+iberico|paleta\s+iberica/,"Carne","Embutido","Nevera","baja","ham-cured","flex"),
 P("jamón cocido",/jamon\s+cocido|jamon\s+york/,"Carne","Embutido","Nevera","media","ham-cooked","cold-required"),
 P("lomo embuchado",/lomo\s+embuchado/,"Carne","Embutido","Nevera","baja","cured-loin","flex"),
 P("chorizo",/chorizo/,"Carne","Embutido","Nevera","media","sausage-cured","flex"),
 P("salchichón",/salchichon/,"Carne","Embutido","Nevera","media","sausage-cured","flex"),
 P("frankfurt",/frankfurt|salchicha.*cocida|hot\s*dog/,"Carne","Salchicha","Nevera","media","frankfurt","cold-required"),
 P("longaniza",/longaniza/,"Carne","Salchicha","Nevera","alta","sausage-fresh","cold-required"),

 // Pescado y marisco
 P("salmón",/salmon/,"Carne","Pescado","Nevera","alta","salmon","cold-required"),
 P("merluza",/merluza/,"Carne","Pescado","Nevera","alta","white-fish","cold-required"),
 P("bacalao",/bacalao/,"Carne","Pescado","Nevera","alta","white-fish","cold-required"),
 P("atún fresco",/atun.*(fresco|filete|lomo)/,"Carne","Pescado","Nevera","alta","tuna-steak","cold-required"),
 P("pescado",/pescado|dorada|lubina|gallineta|rape|lenguado/,"Carne","Pescado","Nevera","alta","fish","cold-required"),
 P("gambas",/gamba|langostino|camaron/,"Carne","Marisco","Nevera","alta","shrimp","cold-required"),
 P("mejillones",/mejillon|almeja|berberecho/,"Carne","Marisco","Nevera","alta","shellfish","cold-required"),

 // Huevos, lácteos y refrigerados
 P("huevos",/huevo/,"Lácteos","Huevos","Nevera","media","egg","cold-required"),
 P("mozzarella rallada",/mozzarella.*rallad|rallad.*mozzarella/,"Lácteos","Queso","Nevera","alta","mozzarella-shredded","cold-required"),
 P("mozzarella en bola",/mozzarella.*(bola|bufala|buffala)|bola.*mozzarella/,"Lácteos","Queso","Nevera","alta","mozzarella-ball","cold-required"),
 P("mozzarella",/mozzarella/,"Lácteos","Queso","Nevera","alta","mozzarella-ball","cold-required"),
 P("queso fresco",/queso\s+fresco|burgos/,"Lácteos","Queso","Nevera","alta","fresh-cheese","cold-required"),
 P("queso lonchas",/queso.*loncha/,"Lácteos","Queso","Nevera","media","cheese-slices","cold-required"),
 P("queso rallado",/queso.*rallad/,"Lácteos","Queso","Nevera","media","cheese-shredded","cold-required"),
 P("queso curado",/queso.*(curado|manchego|parmesano|grana)/,"Lácteos","Queso","Nevera","baja","cheese","flex"),
 P("queso",/queso/,"Lácteos","Queso","Nevera","media","cheese","cold-required"),
 P("yogur",/yogur|yoghurt/,"Lácteos","Yogur","Nevera","alta","yogurt","cold-required"),
 P("kéfir",/kefir/,"Lácteos","Fermentado","Nevera","alta","kefir","cold-required"),
 P("mantequilla",/mantequilla/,"Lácteos","Mantequilla","Nevera","media","butter","cold-required"),
 P("nata",/nata.*(cocinar|montar)|crema\s+de\s+leche/,"Lácteos","Nata","Nevera","media","cream","cold-required"),
 P("leche fresca",/leche\s+fresca/,"Lácteos","Leche","Nevera","alta","milk-bottle","cold-required"),
 P("leche",/leche|bebida\s+(avena|soja|almendra|arroz)/,"Lácteos","Leche y bebidas vegetales","Despensa","media","milk-carton","shelf"),

 // Vegan / proteína vegetal
 P("tofu",/tofu/,"Preparados","Proteína vegetal","Nevera","media","tofu","cold-required"),
 P("seitán",/seitan/,"Preparados","Proteína vegetal","Nevera","media","seitan","cold-required"),
 P("tempeh",/tempeh/,"Preparados","Proteína vegetal","Nevera","media","tempeh","cold-required"),
 P("hummus",/hummus/,"Preparados","Untable","Nevera","alta","hummus","cold-required"),
 P("guacamole",/guacamole/,"Preparados","Untable","Nevera","alta","guacamole","cold-required"),

 // Panadería
 P("pan de hamburguesa",/pan.*hamburguesa|burger\s+bun|brioche.*hamburguesa/,"Despensa","Panadería","Despensa","alta","burger-bun","shelf"),
 P("pan de molde",/pan\s+de\s+molde/,"Despensa","Panadería","Despensa","media","sliced-bread","shelf"),
 P("baguette",/baguette|barra\s+de\s+pan/,"Despensa","Panadería","Despensa","alta","baguette","shelf"),
 P("pan",/\bpan\b|panecillo/,"Despensa","Panadería","Despensa","alta","bread","shelf"),
 P("croissant",/croissant|cruasan/,"Despensa","Bollería","Despensa","alta","croissant","shelf"),

 // Despensa: cereales, harinas, legumbres, conservas
 P("avena",/avena/,"Despensa","Cereales","Despensa","baja","oats","shelf"),
 P("arroz",/arroz/,"Despensa","Cereales","Despensa","baja","rice","shelf"),
 P("pasta",/pasta|macarron|espagueti|spaghetti|tallarines|fusilli/,"Despensa","Pasta","Despensa","baja","pasta","shelf"),
 P("harina",/harina/,"Despensa","Harinas","Despensa","baja","flour","shelf"),
 P("azúcar",/azucar/,"Despensa","Azúcar","Despensa","baja","sugar","shelf"),
 P("sal",/\bsal\b/,"Despensa","Condimentos","Despensa","baja","salt","shelf"),
 P("aceite de oliva",/aceite.*oliva/,"Despensa","Aceite","Despensa","baja","olive-oil","shelf"),
 P("aceite",/aceite/,"Despensa","Aceite","Despensa","baja","oil","shelf"),
 P("lentejas",/lenteja/,"Despensa","Legumbres","Despensa","baja","lentils","shelf"),
 P("garbanzos",/garbanzo/,"Despensa","Legumbres","Despensa","baja","chickpeas","shelf"),
 P("alubias",/alubia|judia\s+(blanca|roja|pinta)|frijol/,"Despensa","Legumbres","Despensa","baja","beans","shelf"),
 P("tomate frito",/tomate\s+frito/,"Despensa","Salsas","Despensa","baja","tomato-jar","shelf"),
 P("tomate triturado",/tomate\s+triturado|tomate\s+en\s+lata/,"Despensa","Conservas","Despensa","baja","tomato-can","shelf"),
 P("atún en lata",/atun.*(lata|conserva|natural|aceite)/,"Despensa","Conservas","Despensa","baja","tuna-can","shelf"),
 P("conserva",/conserva|lata\s+de/,"Despensa","Conservas","Despensa","baja","can","shelf"),
 P("cereales",/cereal/,"Despensa","Cereales","Despensa","baja","cereal-box","shelf"),
 P("frutos secos",/almendra|nuez|pistacho|anacardo|avellana|cacahuete|frutos\s+secos/,"Despensa","Frutos secos","Despensa","baja","nuts","shelf"),

 // Congelados y preparados
 P("patatas de bolsa",/patatas.*(?:de\s+bolsa|chips)|chips\s+de\s+patata/,"Snacks y dulces","Aperitivo","Despensa","baja","chips","shelf"),
 P("patatas fritas congeladas",/patata.*(congelad|frita).*|french\s+fries|patatas\s+fritas/,"Congelados","Patatas","Congelador","baja","frozen-fries","frozen"),
 P("nuggets",/nugget/,"Congelados","Pollo empanado","Congelador","baja","nuggets","frozen"),
 P("verdura congelada",/(brocoli|espinaca|guisante|menestra|verdura|judia).*congelad|congelad.*(brocoli|espinaca|guisante|menestra|verdura|judia)/,"Congelados","Verdura congelada","Congelador","baja","frozen-vegetables","frozen"),
 P("pescado congelado",/(merluza|bacalao|salmon|pescado|gamba|langostino).*congelad|congelad.*(merluza|bacalao|salmon|pescado|gamba|langostino)/,"Congelados","Pescado congelado","Congelador","baja","frozen-fish","frozen"),
 P("pollo rebozado congelado",/(pollo|pechuga|solomillo).*(rebozad|empanad|kentucky)/,"Congelados","Pollo empanado","Congelador","baja","breaded-chicken","frozen"),
 P("croquetas frescas",/croqueta.*(fresca|refrigerad)/,"Preparados","Croquetas","Nevera","alta","croquette","cold-required"),
 P("croquetas",/croqueta/,"Congelados","Croquetas","Congelador","baja","croquette-frozen","frozen"),
 P("lasaña fresca",/lasana.*(fresca|refrigerad)/,"Preparados","Lasaña","Nevera","alta","lasagna","cold-required"),
 P("lasaña",/lasana/,"Congelados","Lasaña","Congelador","baja","lasagna-frozen","frozen"),
 P("pizza fresca",/pizza.*(fresca|refrigerad)/,"Preparados","Pizza","Nevera","alta","pizza","cold-required"),
 P("pizza",/pizza/,"Congelados","Pizza","Congelador","baja","pizza-frozen","frozen"),
 P("tortilla preparada",/tortilla.*(patata|preparad)/,"Preparados","Tortilla","Nevera","alta","tortilla","cold-required"),
 P("ensalada preparada",/ensalada.*(bolsa|preparad)|mezclum/,"Preparados","Ensalada","Nevera","alta","salad","cold-required"),
 P("sushi",/sushi/,"Preparados","Sushi","Nevera","alta","sushi","cold-required"),
 P("sándwich",/sandwich|bocadillo\s+preparado/,"Preparados","Sándwich","Nevera","alta","sandwich","cold-required"),

 // Dulces y snacks
 P("barrita de proteína",/barrita.*prote|protein\s+bar/,"Suplementos","Barritas","Despensa","baja","protein-bar","supplement"),
 P("barrita de chocolate",/barrita.*chocolate/,"Snacks y dulces","Chocolate","Despensa","baja","chocolate-bar","shelf"),
 P("chocolate con almendras",/chocolate.*almendra/,"Snacks y dulces","Chocolate","Despensa","baja","chocolate-almond","shelf"),
 P("chocolate con leche",/chocolate.*leche/,"Snacks y dulces","Chocolate","Despensa","baja","milk-chocolate","shelf"),
 P("chocolate negro",/chocolate.*negro/,"Snacks y dulces","Chocolate","Despensa","baja","dark-chocolate","shelf"),
 P("chocolate",/chocolate/,"Snacks y dulces","Chocolate","Despensa","baja","chocolate","shelf"),
 P("galletas",/galleta/,"Snacks y dulces","Galletas","Despensa","baja","cookie","shelf"),
 P("gominolas",/gominola|chuche|caramelo/,"Snacks y dulces","Golosinas","Despensa","baja","candy","shelf"),
 P("helado",/helado/,"Congelados","Helados","Congelador","baja","ice-cream","frozen"),

 // Bebidas
 P("agua",/\bagua\b/,"Bebidas","Agua","Despensa","baja","water","shelf"),
 P("zumo",/zumo/,"Bebidas","Zumo","Despensa","media","juice","shelf"),
 P("refresco",/refresco|coca\s*cola|cola\s+zero|fanta|sprite/,"Bebidas","Refresco","Despensa","baja","soda","shelf"),
 P("bebida energética",/energetica|energy\s+drink|red\s*bull|monster/,"Bebidas","Energética","Despensa","baja","energy-drink","shelf"),
 P("café",/cafe/,"Despensa","Café","Despensa","baja","coffee","shelf"),
 P("cerveza",/cerveza/,"Bebidas","Cerveza","Despensa","baja","beer","shelf"),
 P("vino",/\bvino\b/,"Bebidas","Vino","Despensa","baja","wine","shelf"),

 // Suplementos
 P("proteína whey",/whey|proteina.*(polvo|suero)|proteina\s+whey/,"Suplementos","Proteína","Suplementos","baja","protein-tub","supplement"),
 P("creatina",/creatina/,"Suplementos","Creatina","Suplementos","baja","creatine","supplement"),
 P("colágeno",/colageno/,"Suplementos","Colágeno","Suplementos","baja","collagen","supplement"),
 P("preentreno",/pre\s*entreno|preworkout|pre\s*workout/,"Suplementos","Preentreno","Suplementos","baja","preworkout","supplement"),
 P("vitaminas",/vitamina|multivitamin|omega\s*3|magnesio/,"Suplementos","Vitaminas","Suplementos","baja","vitamins","supplement"),

 // Limpieza y hogar
 P("detergente lavadora",/detergente.*(lavadora|ropa)|detergente\s+liquido/,"Limpieza y hogar","Lavandería","Despensa","baja","laundry-detergent","household"),
 P("suavizante",/suavizante/,"Limpieza y hogar","Lavandería","Despensa","baja","fabric-softener","household"),
 P("lejía",/lejia/,"Limpieza y hogar","Limpieza","Despensa","baja","bleach","household"),
 P("limpiador multiusos",/multiusos|limpiador.*(hogar|superficie|bano|cocina)/,"Limpieza y hogar","Limpieza","Despensa","baja","spray-cleaner","household"),
 P("lavavajillas líquido",/lavavajillas.*liquid|jabon.*platos|lavaplatos/,"Limpieza y hogar","Lavavajillas","Despensa","baja","dish-soap","household"),
 P("pastillas lavavajillas",/pastilla.*lavavajillas|capsula.*lavavajillas/,"Limpieza y hogar","Lavavajillas","Despensa","baja","dishwasher-tabs","household"),
 P("papel higiénico",/papel\s+higienico/,"Limpieza y hogar","Papel","Despensa","baja","toilet-paper","household"),
 P("papel de cocina",/papel\s+de\s+cocina/,"Limpieza y hogar","Papel","Despensa","baja","kitchen-roll","household"),
 P("servilletas",/servilleta/,"Limpieza y hogar","Papel","Despensa","baja","napkins","household"),
 P("bolsas de basura",/bolsa.*basura/,"Limpieza y hogar","Consumibles","Despensa","baja","trash-bags","household"),

 // Higiene y cuidado personal
 P("champú",/champu/,"Higiene y cuidado","Cabello","Despensa","baja","shampoo","household"),
 P("acondicionador",/acondicionador|mascarilla\s+capilar/,"Higiene y cuidado","Cabello","Despensa","baja","conditioner","household"),
 P("gel de ducha",/gel.*ducha|gel\s+de\s+bano/,"Higiene y cuidado","Ducha","Despensa","baja","shower-gel","household"),
 P("jabón de manos",/jabon.*mano/,"Higiene y cuidado","Manos","Despensa","baja","hand-soap","household"),
 P("desodorante",/desodorante/,"Higiene y cuidado","Higiene","Despensa","baja","deodorant","household"),
 P("pasta de dientes",/pasta.*diente|dentifrico/,"Higiene y cuidado","Dental","Despensa","baja","toothpaste","household"),
 P("perfume",/perfume|colonia|eau\s+de|bruma\s+corporal/,"Higiene y cuidado","Fragancia","Despensa","baja","perfume","household"),
 P("crema corporal",/crema\s+corporal|locion\s+corporal|body\s+lotion/,"Higiene y cuidado","Cuerpo","Despensa","baja","body-lotion","household"),
 P("crema facial",/crema\s+facial|hidratante\s+facial/,"Higiene y cuidado","Facial","Despensa","baja","face-cream","household"),
 P("protector solar",/protector\s+solar|fotoprotector|spf\s*\d+/,"Higiene y cuidado","Solar","Despensa","baja","sunscreen","household"),
];


/* Specific supermarket references checked before the broad family rules.
   Brand/flavour variants collapse into these household-level product types. */
const EXTRA_RULES:Rule[]=[
 P("sandía negra",/sandia.*negra/,"Fruta y verdura","Fruta","Despensa","alta","watermelon","flex"),
 P("sandía rayada",/sandia.*rayada/,"Fruta y verdura","Fruta","Despensa","alta","watermelon","flex"),
 P("sandía mini",/sandia.*mini/,"Fruta y verdura","Fruta","Despensa","alta","watermelon","flex"),
 P("melón amarillo",/melon.*amarillo/,"Fruta y verdura","Fruta","Despensa","alta","melon","flex"),
 P("pipas de girasol",/pipas.*girasol/,"Despensa","Frutos secos","Despensa","baja","nuts","shelf"),
 P("pipas de calabaza",/pipas.*calabaza/,"Despensa","Semillas","Despensa","baja","nuts","shelf"),
 P("jamón en taquitos",/jamon.*(taquito|taco|dado)/,"Carne","Charcutería","Nevera","media","ham-cured","cold-required"),
 P("hígado de ave",/higado.*(ave|pollo)/,"Carne","Casquería","Nevera","alta","meat","cold-required"),
 P("corazones de pollo",/corazon.*pollo/,"Carne","Casquería","Nevera","alta","meat","cold-required"),
 P("mollejas de pollo",/molleja.*pollo/,"Carne","Casquería","Nevera","alta","meat","cold-required"),
 P("grasa de pato",/grasa.*pato/,"Carne","Grasas","Nevera","baja","butter","flex"),
 P("picantón",/picanton/,"Carne","Aves","Nevera","alta","chicken-whole","cold-required"),
 P("pimienta blanca",/pimienta.*blanca/,"Despensa","Especias","Despensa","baja","pantry","shelf"),
 P("pimienta negra",/pimienta/,"Despensa","Especias","Despensa","baja","pantry","shelf"),
 P("pimentón picante",/pimenton.*picante/,"Despensa","Especias","Despensa","baja","pantry","shelf"),
 P("pimentón dulce",/pimenton/,"Despensa","Especias","Despensa","baja","pantry","shelf"),
 P("vinagre de manzana",/vinagre.*manzana/,"Despensa","Aliños","Despensa","baja","oil","shelf"),
 P("vinagre de vino",/vinagre.*vino/,"Despensa","Aliños","Despensa","baja","oil","shelf"),
 P("tomate cherry amarillo",/tomate.*cherry.*amarillo/,"Fruta y verdura","Verdura","Nevera","alta","tomato-cherry","flex"),
 P("tomate en rama",/tomate.*rama/,"Fruta y verdura","Verdura","Nevera","alta","tomato","flex"),
 P("tomate pera",/tomate.*pera/,"Fruta y verdura","Verdura","Nevera","alta","tomato","flex"),
 P("tomate rosa",/tomate.*rosa/,"Fruta y verdura","Verdura","Nevera","alta","tomato","flex"),
 P("tomate raf",/tomate.*raf/,"Fruta y verdura","Verdura","Nevera","alta","tomato","flex"),
 P("tomate negro",/tomate.*negro|kumato/,"Fruta y verdura","Verdura","Nevera","alta","tomato","flex"),
 P("aceite de girasol",/aceite.*girasol/,"Despensa","Aceites","Despensa","baja","oil","shelf"),
 P("albahaca",/albahaca/,"Despensa","Hierbas aromáticas","Sin ubicar","media","leafy","flex"),
 P("orégano",/oregano/,"Despensa","Hierbas aromáticas","Sin ubicar","baja","leafy","flex"),
 P("romero",/romero/,"Despensa","Hierbas aromáticas","Sin ubicar","baja","leafy","flex"),
 P("tomillo",/tomillo/,"Despensa","Hierbas aromáticas","Sin ubicar","baja","leafy","flex"),
 P("laurel",/laurel/,"Despensa","Hierbas aromáticas","Sin ubicar","baja","leafy","flex"),
 // More common supermarket products and modern plant-based ranges
 P("burrata",/\bburrata\b/,"Lácteos","Queso fresco","Nevera","alta","mozzarella-ball","cold-required"),
 P("provolone",/\bprovolone\b/,"Lácteos","Queso","Nevera","media","cheese","cold-required"),
 P("raclette",/\braclette\b/,"Lácteos","Queso","Nevera","media","cheese","cold-required"),
 P("kale",/\bkale\b|col\s+rizada/,"Fruta y verdura","Verdura","Nevera","alta","leafy","flex"),
 P("pak choi",/pak\s*choi|bok\s*choy/,"Fruta y verdura","Verdura","Nevera","alta","leafy","flex"),
 P("yuca",/\byuca\b|mandioca/,"Fruta y verdura","Verdura","Despensa","media","potato","flex"),
 P("chirivía",/chirivia/,"Fruta y verdura","Verdura","Nevera","media","carrot","flex"),
 P("nabo",/\bnabo\b|nabos/,"Fruta y verdura","Verdura","Nevera","media","turnip","flex"),
 P("edamame",/\bedamame\b/,"Congelados","Legumbre congelada","Congelador","baja","frozen-vegetables","frozen"),
 P("kimchi",/\bkimchi\b/,"Preparados","Fermentado","Nevera","media","prepared","cold-required"),
 P("kombucha",/\bkombucha\b/,"Bebidas","Fermentada","Nevera","media","drink","cold-required"),
 P("tahini",/\btahini\b|pasta\s+de\s+sesamo/,"Despensa","Untable","Despensa","baja","pantry","shelf"),
 P("semillas de chía",/chia/,"Despensa","Semillas","Despensa","baja","grain","shelf"),
 P("semillas de lino",/semillas.*lino|linaza/,"Despensa","Semillas","Despensa","baja","grain","shelf"),
 P("soja texturizada",/soja.*texturiz|proteina.*vegetal.*texturiz/,"Despensa","Proteína vegetal","Despensa","baja","pantry","shelf"),
 P("hamburguesa vegetal",/(hamburguesa|burger).*(vegetal|vegana|veggie|plant)/,"Preparados","Proteína vegetal","Nevera","media","burger-patty","cold-required"),
 P("salchicha vegetal",/salchicha.*(vegetal|vegana|veggie|plant)/,"Preparados","Proteína vegetal","Nevera","media","sausage-fresh","cold-required"),
 P("proteína vegetal preparada",/\bheura\b|bocados.*vegetales|tiras.*vegetales/,"Preparados","Proteína vegetal","Nevera","media","seitan","cold-required"),
 P("leche evaporada",/leche.*evaporada/,"Despensa","Lácteo en conserva","Despensa","baja","milk-carton","shelf"),
 P("leche condensada",/leche.*condensada/,"Despensa","Repostería","Despensa","baja","milk-carton","shelf"),
 P("focaccia",/\bfocaccia\b/,"Despensa","Panadería","Despensa","alta","bread","shelf"),
 P("pan de pita",/pan.*pita|\bpita\b/,"Despensa","Panadería","Despensa","media","bread","shelf"),
 P("sriracha",/\bsriracha\b/,"Despensa","Salsas","Despensa","baja","bbq-sauce","shelf"),

 // High-priority compound names that must beat broad family matches
 P("pan de hamburguesa",/pan.*hamburguesa|burger\s+bun|brioche.*hamburguesa/,"Despensa","Panadería","Despensa","alta","burger-bun","shelf"),
 P("chocolate con almendras",/chocolate.*almendra/,"Snacks y dulces","Chocolate","Despensa","baja","chocolate-almond","shelf"),
 P("chocolate con leche",/chocolate.*leche/,"Snacks y dulces","Chocolate","Despensa","baja","milk-chocolate","shelf"),
 P("pasta de dientes",/pasta.*diente|dentifrico/,"Higiene y cuidado","Dental","Despensa","baja","toothpaste","household"),
 P("tortilla preparada",/tortilla.*(patata|preparad)/,"Preparados","Tortilla","Nevera","alta","tortilla","cold-required"),
 P("pescado congelado",/(merluza|bacalao|salmon|pescado|gamba|langostino).*congelad|congelad.*(merluza|bacalao|salmon|pescado|gamba|langostino)/,"Congelados","Pescado congelado","Congelador","baja","frozen-fish","frozen"),
 P("calamares rebozados",/calamar.*rebozad/,"Congelados","Marisco rebozado","Congelador","baja","breaded-squid","frozen"),

 // Quesos y lácteos
 P("queso manchego",/queso.*manchego|manchego.*queso/,"Lácteos","Queso curado","Nevera","baja","cheese","flex"),
 P("queso cheddar",/cheddar/,"Lácteos","Queso","Nevera","media","cheddar","cold-required"),
 P("queso gouda",/gouda/,"Lácteos","Queso","Nevera","media","gouda","cold-required"),
 P("queso edam",/\bedam\b/,"Lácteos","Queso","Nevera","media","edam","cold-required"),
 P("queso emmental",/emmental/,"Lácteos","Queso","Nevera","media","emmental","cold-required"),
 P("queso havarti",/havarti/,"Lácteos","Queso","Nevera","media","havarti","cold-required"),
 P("queso brie",/\bbrie\b/,"Lácteos","Queso blando","Nevera","alta","brie","cold-required"),
 P("queso camembert",/camembert/,"Lácteos","Queso blando","Nevera","alta","camembert","cold-required"),
 P("queso azul",/queso.*azul|roquefort|gorgonzola/,"Lácteos","Queso azul","Nevera","media","blue-cheese","cold-required"),
 P("queso de cabra",/queso.*cabra|rulo.*cabra/,"Lácteos","Queso","Nevera","media","goat-cheese","cold-required"),
 P("queso feta",/\bfeta\b/,"Lácteos","Queso","Nevera","media","feta","cold-required"),
 P("parmesano",/parmesano|parmigiano|grana padano/,"Lácteos","Queso curado","Nevera","baja","parmesan","flex"),
 P("ricotta",/ricotta/,"Lácteos","Queso fresco","Nevera","alta","ricotta","cold-required"),
 P("mascarpone",/mascarpone/,"Lácteos","Queso fresco","Nevera","alta","mascarpone","cold-required"),
 P("queso crema",/queso.*crema|cream cheese/,"Lácteos","Queso crema","Nevera","alta","cream-cheese","cold-required"),
 P("cottage",/cottage/,"Lácteos","Queso fresco","Nevera","alta","cottage","cold-required"),
 P("skyr",/\bskyr\b/,"Lácteos","Yogur","Nevera","alta","yogurt","cold-required"),
 P("yogur griego",/yogur.*griego|griego.*yogur/,"Lácteos","Yogur","Nevera","alta","greek-yogurt","cold-required"),
 P("yogur natural",/yogur.*natural|natural.*yogur/,"Lácteos","Yogur","Nevera","alta","yogurt","cold-required"),
 P("yogur bífidus",/bifidus|yogur.*bifid/,"Lácteos","Yogur","Nevera","alta","yogurt","cold-required"),
 P("postre lácteo",/natilla|flan.*(huevo|vainilla)|postre.*lacteo/,"Lácteos","Postre lácteo","Nevera","alta","dairy-dessert","cold-required"),

 // Carne, aves y charcutería
 P("chuleta de cerdo",/chuleta.*cerdo/,"Carne","Cerdo","Nevera","alta","pork-chop","cold-required"),
 P("aguja de cerdo",/aguja.*cerdo/,"Carne","Cerdo","Nevera","alta","steak","cold-required"),
 P("carrillera",/carrillera/,"Carne","Vacuno o cerdo","Nevera","alta","stew-meat","cold-required"),
 P("carne para guisar",/carne.*guisar|estofado.*ternera|ragout/,"Carne","Vacuno","Nevera","alta","stew-meat","cold-required"),
 P("osobuco",/osobuco/,"Carne","Vacuno","Nevera","alta","osso-buco","cold-required"),
 P("chuletón",/chuleton|chuleta.*vacuno/,"Carne","Vacuno","Nevera","alta","steak","cold-required"),
 P("albóndigas frescas",/albondiga.*(fresca|refrigerad)|albondigas$/,"Carne","Carne picada","Nevera","alta","meatballs","cold-required"),
 P("salchicha fresca",/salchicha.*fresca|butifarra/,"Carne","Salchicha","Nevera","alta","sausage-fresh","cold-required"),
 P("mortadela",/mortadela/,"Carne","Embutido","Nevera","media","cold-cuts","cold-required"),
 P("fuet",/\bfuet\b|espetec/,"Carne","Embutido","Nevera","baja","sausage-cured","flex"),
 P("salami",/salami/,"Carne","Embutido","Nevera","media","sausage-cured","flex"),
 P("sobrasada",/sobrasada/,"Carne","Embutido","Nevera","media","sobrasada","cold-required"),
 P("pechuga de pavo lonchas",/pavo.*loncha|pechuga.*pavo.*loncha/,"Carne","Fiambre","Nevera","media","turkey-slices","cold-required"),
 P("pollo asado preparado",/pollo.*asado.*(preparad|listo)|pollo\\s+asado$/,"Preparados","Pollo preparado","Nevera","alta","roast-chicken","cold-required"),

 // Pescado y marisco
 P("dorada",/dorada/,"Carne","Pescado","Nevera","alta","fish","cold-required"),
 P("lubina",/lubina/,"Carne","Pescado","Nevera","alta","fish","cold-required"),
 P("sardinas",/sardina/,"Carne","Pescado","Nevera","alta","fish","cold-required"),
 P("boquerones",/boqueron|anchoa.*fresca/,"Carne","Pescado","Nevera","alta","fish-small","cold-required"),
 P("caballa",/caballa/,"Carne","Pescado","Nevera","alta","fish","cold-required"),
 P("trucha",/trucha/,"Carne","Pescado","Nevera","alta","fish","cold-required"),
 P("calamar",/calamar|chipiron/,"Carne","Marisco","Nevera","alta","squid","cold-required"),
 P("pulpo",/pulpo/,"Carne","Marisco","Nevera","alta","octopus","cold-required"),
 P("sepia",/sepia/,"Carne","Marisco","Nevera","alta","squid","cold-required"),
 P("surimi",/surimi|palitos.*cangrejo/,"Preparados","Surimi","Nevera","media","surimi","cold-required"),

 // Verduras, frutas y aromáticas
 P("judías verdes",/judia.*verde/,"Fruta y verdura","Verdura","Nevera","alta","green-beans","flex"),
 P("guisantes frescos",/guisante.*fresc/,"Fruta y verdura","Verdura","Nevera","alta","peas","flex"),
 P("puerro",/puerro/,"Fruta y verdura","Verdura","Nevera","media","leek","flex"),
 P("apio",/apio/,"Fruta y verdura","Verdura","Nevera","media","celery","flex"),
 P("alcachofa",/alcachofa/,"Fruta y verdura","Verdura","Nevera","alta","artichoke","flex"),
 P("espárragos",/esparrago.*fresc/,"Fruta y verdura","Verdura","Nevera","alta","asparagus","flex"),
 P("remolacha",/remolacha/,"Fruta y verdura","Verdura","Nevera","media","beet","flex"),
 P("calabaza",/calabaza/,"Fruta y verdura","Verdura","Despensa","media","pumpkin","flex"),
 P("maíz dulce",/maiz.*(dulce|mazorca)|mazorca/,"Fruta y verdura","Verdura","Nevera","media","corn","flex"),
 P("hierbas frescas",/perejil|cilantro|albahaca|menta|hierbabuena/,"Fruta y verdura","Hierbas","Nevera","alta","herbs","flex"),
 P("ciruela",/ciruela/,"Fruta y verdura","Fruta","Nevera","media","plum","flex"),
 P("cereza",/cereza/,"Fruta y verdura","Fruta","Nevera","alta","cherry","flex"),
 P("higo",/\bhigo|higos/,"Fruta y verdura","Fruta","Nevera","alta","fig","flex"),
 P("caqui",/caqui|kaki/,"Fruta y verdura","Fruta","Despensa","media","persimmon","flex"),

 // Despensa, salsas y condimentos
 P("pasta fresca",/pasta.*fresca|ravioli.*fresc|tortellini.*fresc/,"Preparados","Pasta fresca","Nevera","alta","fresh-pasta","cold-required"),
 P("cuscús",/cuscus|couscous/,"Despensa","Cereales","Despensa","baja","couscous","shelf"),
 P("quinoa",/quinoa/,"Despensa","Cereales","Despensa","baja","quinoa","shelf"),
 P("bulgur",/bulgur/,"Despensa","Cereales","Despensa","baja","grain","shelf"),
 P("pan rallado",/pan.*rallado/,"Despensa","Pan rallado","Despensa","baja","breadcrumbs","shelf"),
 P("levadura",/levadura/,"Despensa","Repostería","Despensa","baja","yeast","shelf"),
 P("maicena",/maicena|almidon.*maiz/,"Despensa","Harinas","Despensa","baja","cornstarch","shelf"),
 P("miel",/\bmiel\b/,"Despensa","Endulzante","Despensa","baja","honey","shelf"),
 P("mermelada",/mermelada|confitura/,"Despensa","Untable","Despensa","baja","jam","shelf"),
 P("crema de cacahuete",/crema.*cacahuete|mantequilla.*cacahuete/,"Despensa","Untable","Despensa","baja","peanut-butter","shelf"),
 P("ketchup",/ketchup/,"Despensa","Salsas","Despensa","baja","ketchup","shelf"),
 P("mayonesa",/mayonesa/,"Despensa","Salsas","Despensa","baja","mayonnaise","shelf"),
 P("mostaza",/mostaza/,"Despensa","Salsas","Despensa","baja","mustard","shelf"),
 P("salsa barbacoa",/salsa.*barbacoa|bbq/,"Despensa","Salsas","Despensa","baja","bbq-sauce","shelf"),
 P("pesto",/\bpesto\b/,"Despensa","Salsas","Despensa","media","pesto","shelf"),
 P("salsa de soja",/salsa.*soja/,"Despensa","Salsas","Despensa","baja","soy-sauce","shelf"),
 P("vinagre",/vinagre/,"Despensa","Condimentos","Despensa","baja","vinegar","shelf"),
 P("caldo",/caldo.*(pollo|verdura|carne|pescado)|brick.*caldo/,"Despensa","Caldos","Despensa","baja","broth","shelf"),
 P("cubitos de caldo",/cubito.*caldo|pastilla.*caldo/,"Despensa","Condimentos","Despensa","baja","stock-cube","shelf"),
 P("especias",/pimienta|oregano|comino|curcuma|curry|paprika|pimenton|canela/,"Despensa","Especias","Despensa","baja","spices","shelf"),

 // Desayuno y repostería
 P("muesli",/muesli/,"Despensa","Cereales","Despensa","baja","muesli","shelf"),
 P("granola",/granola/,"Despensa","Cereales","Despensa","baja","granola","shelf"),
 P("tostadas",/tostada.*envasad|biscote/,"Despensa","Panadería","Despensa","baja","toast","shelf"),
 P("tortitas de arroz",/tortita.*arroz/,"Despensa","Snack","Despensa","baja","rice-cakes","shelf"),
 P("cacao soluble",/cacao.*soluble|cacao.*polvo/,"Despensa","Cacao","Despensa","baja","cocoa","shelf"),
 P("siropes",/sirope|jarabe.*(arce|agave)/,"Despensa","Endulzante","Despensa","baja","syrup","shelf"),

 // Congelados y preparados
 P("empanadillas congeladas",/empanadilla.*congelad/,"Congelados","Empanadillas","Congelador","baja","frozen-pastry","frozen"),
 P("calamares rebozados",/calamar.*rebozad/,"Congelados","Marisco rebozado","Congelador","baja","breaded-squid","frozen"),
 P("varitas de pescado",/varita.*pescado/,"Congelados","Pescado rebozado","Congelador","baja","fish-sticks","frozen"),
 P("verduras salteadas congeladas",/salteado.*verdura.*congelad/,"Congelados","Verdura congelada","Congelador","baja","frozen-vegetables","frozen"),
 P("fruta congelada",/(fruta|fresa|arandano|mango|frutos.*rojos).*congelad/,"Congelados","Fruta congelada","Congelador","baja","frozen-fruit","frozen"),
 P("gazpacho",/gazpacho|salmorejo/,"Preparados","Sopa fría","Nevera","alta","gazpacho","cold-required"),
 P("crema de verduras preparada",/crema.*verdura.*(preparad|refrigerad)|sopa.*refrigerad/,"Preparados","Sopa","Nevera","alta","soup","cold-required"),
 P("canelones",/canelon/,"Preparados","Pasta preparada","Nevera","alta","cannelloni","cold-required"),
 P("ensaladilla rusa",/ensaladilla/,"Preparados","Ensalada preparada","Nevera","alta","prepared-salad","cold-required"),
 P("tortilla de trigo",/tortilla.*trigo|wraps?/,"Despensa","Pan plano","Despensa","media","wrap","shelf"),

 // Bebidas
 P("leche sin lactosa",/leche.*sin\\s+lactosa/,"Lácteos","Leche","Despensa","media","milk-carton","shelf"),
 P("bebida de avena",/bebida.*avena/,"Bebidas","Bebida vegetal","Despensa","media","oat-drink","shelf"),
 P("bebida de soja",/bebida.*soja/,"Bebidas","Bebida vegetal","Despensa","media","soy-drink","shelf"),
 P("bebida de almendra",/bebida.*almendra/,"Bebidas","Bebida vegetal","Despensa","media","almond-drink","shelf"),
 P("té e infusiones",/\bte\b|infusion|manzanilla|rooibos/,"Despensa","Infusiones","Despensa","baja","tea","shelf"),
 P("agua con gas",/agua.*gas/,"Bebidas","Agua","Despensa","baja","sparkling-water","shelf"),

 // Limpieza y hogar
 P("detergente en polvo",/detergente.*polvo/,"Limpieza y hogar","Lavandería","Despensa","baja","laundry-powder","household"),
 P("cápsulas de lavadora",/capsula.*lavadora|pods.*lavadora/,"Limpieza y hogar","Lavandería","Despensa","baja","laundry-pods","household"),
 P("quitamanchas",/quitamanchas/,"Limpieza y hogar","Lavandería","Despensa","baja","stain-remover","household"),
 P("limpiacristales",/limpiacristal/,"Limpieza y hogar","Limpieza","Despensa","baja","glass-cleaner","household"),
 P("limpiador de baño",/limpiador.*bano|antical/,"Limpieza y hogar","Baño","Despensa","baja","bath-cleaner","household"),
 P("limpiador de suelo",/limpiador.*suelo|friegasuelos/,"Limpieza y hogar","Suelo","Despensa","baja","floor-cleaner","household"),
 P("esponjas",/esponja.*(cocina|lavar)|estropajo/,"Limpieza y hogar","Consumibles","Despensa","baja","sponge","household"),
 P("film transparente",/film.*transparente|papel.*film/,"Limpieza y hogar","Cocina","Despensa","baja","cling-film","household"),
 P("papel aluminio",/papel.*aluminio/,"Limpieza y hogar","Cocina","Despensa","baja","foil","household"),
 P("bolsas congelación",/bolsa.*congel/,"Limpieza y hogar","Cocina","Despensa","baja","freezer-bags","household"),

 // Higiene y cuidado
 P("gel hidroalcohólico",/gel.*hidroalcohol/,"Higiene y cuidado","Higiene","Despensa","baja","sanitizer","household"),
 P("enjuague bucal",/enjuague.*bucal|colutorio/,"Higiene y cuidado","Dental","Despensa","baja","mouthwash","household"),
 P("cepillo de dientes",/cepillo.*dient/,"Higiene y cuidado","Dental","Despensa","baja","toothbrush","household"),
 P("hilo dental",/hilo.*dental/,"Higiene y cuidado","Dental","Despensa","baja","dental-floss","household"),
 P("algodón",/algodon.*(disco|desmaquill)|disco.*algodon/,"Higiene y cuidado","Facial","Despensa","baja","cotton-pads","household"),
 P("toallitas húmedas",/toallita.*humed/,"Higiene y cuidado","Higiene","Despensa","baja","wipes","household"),
 P("cuchillas de afeitar",/cuchilla.*afeit|maquinilla.*afeit/,"Higiene y cuidado","Afeitado","Despensa","baja","razor","household"),
 P("espuma de afeitar",/espuma.*afeit|gel.*afeit/,"Higiene y cuidado","Afeitado","Despensa","baja","shaving","household")
];

const CATEGORY_FALLBACKS:Record<string,ProductProfile>={
 "Por clasificar":{canonical:"producto por clasificar",category:"Por clasificar",subcategory:"Sin clasificar",location:"Sin ubicar",rotation:"media",icon:"unknown",safety:"unknown"},
 "Fruta y verdura":{canonical:"fruta o verdura",category:"Fruta y verdura",subcategory:"Fresco",location:"Nevera",rotation:"alta",icon:"leafy",safety:"flex"},
 "Lácteos":{canonical:"lácteo",category:"Lácteos",subcategory:"Lácteo",location:"Nevera",rotation:"media",icon:"dairy",safety:"cold-required"},
 "Carne":{canonical:"carne o pescado",category:"Carne",subcategory:"Fresco",location:"Nevera",rotation:"alta",icon:"meat","safety":"cold-required"},
 "Preparados":{canonical:"preparado",category:"Preparados",subcategory:"Preparado",location:"Nevera",rotation:"alta",icon:"prepared",safety:"cold-required"},
 "Suplementos":{canonical:"suplemento",category:"Suplementos",subcategory:"Suplemento",location:"Suplementos",rotation:"baja",icon:"supplement",safety:"supplement"},
 "Limpieza y hogar":{canonical:"producto de hogar",category:"Limpieza y hogar",subcategory:"Hogar",location:"Despensa",rotation:"baja",icon:"cleaning",safety:"household"},
 "Higiene y cuidado":{canonical:"higiene",category:"Higiene y cuidado",subcategory:"Higiene",location:"Despensa",rotation:"baja",icon:"personal-care",safety:"household"},
 "Congelados":{canonical:"congelado",category:"Congelados",subcategory:"Congelado",location:"Congelador",rotation:"baja",icon:"frozen",safety:"frozen"},
 "Bebidas":{canonical:"bebida",category:"Bebidas",subcategory:"Bebida",location:"Despensa",rotation:"media",icon:"drink",safety:"shelf"},
 "Snacks y dulces":{canonical:"snack",category:"Snacks y dulces",subcategory:"Snack",location:"Despensa",rotation:"baja",icon:"snack",safety:"shelf"},
 "Despensa":{canonical:"despensa",category:"Despensa",subcategory:"Despensa",location:"Despensa",rotation:"baja",icon:"pantry",safety:"shelf"},
};

const classificationCache=new Map<string,ProductProfile>();
export function classifyProduct(name:string,currentCategory?:string):ProductProfile{
 const key=name+"|"+(currentCategory||"");const hit=classificationCache.get(key);if(hit)return hit;
 const result=classifyProductUncached(name,currentCategory);
 if(classificationCache.size>5000)classificationCache.clear();classificationCache.set(key,result);return result;
}
function classifyProductUncached(name:string,currentCategory?:string):ProductProfile{
 const n=normalizeProductText(name);
 const variant=findProductVariety(name);
 const base=variant?normalizeProductText(variant.base):n;
 const found=EXTRA_RULES.find(r=>normalizeProductText(r.canonical)===n)||RULES.find(r=>normalizeProductText(r.canonical)===n)||EXTRA_RULES.find(r=>r.match.test(n))||RULES.find(r=>r.match.test(n))||EXTRA_RULES.find(r=>r.match.test(base))||RULES.find(r=>r.match.test(base));
 if(variant){
  const defaults:Record<string,ProductProfile>={
   "setas":{canonical:variant.name,category:"Fruta y verdura",subcategory:"Verdura",location:"Nevera",rotation:"alta",icon:"mushroom",safety:"flex"},
   "col":{canonical:variant.name,category:"Fruta y verdura",subcategory:"Verdura",location:"Nevera",rotation:"alta",icon:"leafy",safety:"flex"},
   "marisco cocido":{canonical:variant.name,category:"Preparados",subcategory:"Marisco cocido",location:"Nevera",rotation:"alta",icon:"shellfish",safety:"cold-required"},
   "conserva de pescado":{canonical:variant.name,category:"Despensa",subcategory:"Conservas",location:"Despensa",rotation:"baja",icon:"can",safety:"shelf"},
   "legumbres cocidas":{canonical:variant.name,category:"Despensa",subcategory:"Legumbres cocidas",location:"Despensa",rotation:"baja",icon:"beans",safety:"shelf"},
   "legumbres secas":{canonical:variant.name,category:"Despensa",subcategory:"Legumbres",location:"Despensa",rotation:"baja",icon:"beans",safety:"shelf"},
   "arroz cocido":{canonical:variant.name,category:"Preparados",subcategory:"Arroz cocido",location:"Nevera",rotation:"alta",icon:"rice",safety:"cold-required"},
   "especias":{canonical:variant.name,category:"Despensa",subcategory:"Condimentos",location:"Despensa",rotation:"baja",icon:"salt",safety:"shelf"},
   "salsas":{canonical:variant.name,category:"Despensa",subcategory:"Salsas",location:"Despensa",rotation:"baja",icon:"pantry",safety:"shelf"},
   "bebida":{canonical:variant.name,category:"Bebidas",subcategory:"Bebida",location:"Despensa",rotation:"media",icon:"drink",safety:"shelf"},
   "snack":{canonical:variant.name,category:"Snacks y dulces",subcategory:"Snack",location:"Despensa",rotation:"baja",icon:"snack",safety:"shelf"}
  };
  const fallback=defaults[variant.base]||CATEGORY_FALLBACKS[currentCategory||"Despensa"];
  const {match,...profile}=found||{match:/.*/, ...fallback};
  if(/congelad/.test(n))return {...profile,canonical:variant.name,category:"Congelados",location:"Congelador",rotation:"baja",safety:"frozen",icon:/verdura|fruto|fresa|mango|pina|brocoli|coliflor|espinaca|judia|guisante|haba|zanahoria|alcachofa|menestra/.test(n)?"frozen-vegetables":profile.icon};
  const forced=["conserva de pescado","legumbres cocidas","legumbres secas","arroz cocido","marisco cocido"].includes(variant.base)?defaults[variant.base]:profile;
  return {...forced,canonical:variant.name};
 }
 if(found){
  const {match,...profile}=found;
  return profile;
 }
 return currentCategory&&CATEGORY_FALLBACKS[currentCategory]?CATEGORY_FALLBACKS[currentCategory]:CATEGORY_FALLBACKS["Por clasificar"];
}

export function recommendedLocation(name:string,currentCategory?:string,preferred?:string){
 const profile=classifyProduct(name,currentCategory);
 if(preferred==="Congelador"&&profile.safety==="cold-required") return "Congelador" as ProductLocation;
 if(preferred==="Nevera"&&["cold-required","flex","shelf"].includes(profile.safety)) return "Nevera" as ProductLocation;
 if(preferred==="Despensa"&&["shelf","household","supplement","flex"].includes(profile.safety)) return "Despensa" as ProductLocation;
 if(preferred==="Suplementos"&&profile.safety==="supplement") return "Suplementos" as ProductLocation;
 return profile.location;
}

export function canStoreAt(name:string,category:string,location:string){
 const p=classifyProduct(name,category);
 if(location==="Sin ubicar") return true;
 if(p.safety==="unknown") return true;
 if(location==="Congelador") return p.safety!=="household"&&p.safety!=="supplement";
 if(location==="Nevera") return p.safety!=="household";
 if(location==="Suplementos") return p.safety==="supplement";
 if(location==="Despensa") return !["cold-required","frozen"].includes(p.safety);
 return true;
}

export function storageWarning(name:string,category:string,location:string){
 const p=classifyProduct(name,category);
 if(canStoreAt(name,category,location)) return "";
 if(p.safety==="cold-required"&&location==="Despensa") return "Este producto necesita frío. HomeOS no recomienda guardarlo en despensa.";
 if(p.safety==="frozen"&&location!=="Congelador") return "Este producto se clasifica como congelado y debe mantenerse en congelador según su envase.";
 if(p.safety==="unknown") return "";
 return "La ubicación elegida no encaja con la conservación habitual de este producto.";
}

export function catalogStats(){
 const all=[...EXTRA_RULES,...RULES]; return {rules:all.length,categories:new Set(all.map(r=>r.category)).size,subcategories:new Set(all.map(r=>r.subcategory)).size};
}


export function freezerQualityGuide(name:string,category?:string,subcategory?:string){
 const n=normalizeProductText(name+" "+(subcategory||""));
 // Quality guidance for food continuously frozen around -18 °C.
 if(/bacon|salchicha|frankfurt|longaniza|butifarra|hot dog/.test(n)) return {minMonths:1,maxMonths:2,label:"1–2 meses"};
 if(/hamburguesa|carne picada|picada/.test(n)) return {minMonths:3,maxMonths:4,label:"3–4 meses"};
 if(/entrecot|solomillo|filete|chuleta|chuleton|roast|asado crudo|lomo|costilla|secreto|presa|pluma|cordero/.test(n)) return {minMonths:4,maxMonths:12,label:"4–12 meses"};
 if(/pollo entero|pavo entero/.test(n)) return {minMonths:12,maxMonths:12,label:"12 meses"};
 if(/pollo|pavo|pechuga|muslo|contramuslo|alita/.test(n)) return {minMonths:9,maxMonths:9,label:"9 meses"};
 if(/salmon|atun|caballa|sardina|pescado azul/.test(n)) return {minMonths:2,maxMonths:3,label:"2–3 meses"};
 if(/merluza|bacalao|lenguado|rape|dorada|lubina|pescado blanco/.test(n)) return {minMonths:4,maxMonths:8,label:"4–8 meses"};
 if(/gamba|langostino|camaron|calamar|sepia/.test(n)) return {minMonths:6,maxMonths:18,label:"6–18 meses"};
 if(/pizza/.test(n)) return {minMonths:1,maxMonths:2,label:"1–2 meses"};
 if(/nugget|pollo rebozado|empanad/.test(n)) return {minMonths:1,maxMonths:3,label:"1–3 meses"};
 if(/sopa|guiso|estofado|crema de verduras/.test(n)) return {minMonths:2,maxMonths:3,label:"2–3 meses"};
 if(category==="Preparados") return {minMonths:2,maxMonths:6,label:"2–6 meses"};
 return null;
}

export function addMonthsIso(dateIso:string,months:number){
 const d=new Date(dateIso+"T12:00:00");
 d.setMonth(d.getMonth()+months);
 return d.toISOString().slice(0,10);
}


export function detectProductsInText(text:string){
 const n=normalizeProductText(text);
 const all=[...EXTRA_RULES,...RULES];
 const seen=new Set<string>();
 const out:ProductProfile[]=[];
 for(const rule of all){
  if(rule.match.test(n)&&!seen.has(rule.canonical)){
   seen.add(rule.canonical);
   const {match,...profile}=rule;
   out.push(profile);
  }
 }
 // Prefer the most specific variants when a broad family also matched.
 return out.filter((p,idx,arr)=>!arr.some((q,j)=>j!==idx&&q.canonical!==p.canonical&&q.canonical.includes(p.canonical)&&q.canonical.length>p.canonical.length));
}

export function registeredProductNames(){return [...new Set([...EXTRA_RULES,...RULES].map(r=>r.canonical).concat(PRODUCT_VARIETIES.map(v=>v.name)))];}
