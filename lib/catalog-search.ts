import { normalizeProductText } from './product-engine';
const groups=[
 ['huevo','huevos','ou','ous','egg','eggs'],['frito','fritos','frita','frits','fregit','fregits','ferrat','ferrats','fried'],
 ['pollo','pollastre','chicken'],['pavo','gall dindi','turkey'],['ternera','vedella','res','beef'],['cerdo','porc','pork'],
 ['pescado','peix','fish'],['salmon','salmo'],['atun','tonyina','tuna'],['bacalao','bacalla','cod'],['merluza','lluc','hake'],
 ['tomate','tomates','tomaquet','tomaquets','tomato','tomatoes'],['patata','patatas','potato','potatoes'],
 ['arroz','arros','rice'],['queso','formatge','cheese'],['leche','llet','milk'],['yogur','iogurt','yogurt','yoghurt'],
 ['pan','pa','bread'],['aceite','oli','oil'],['cebolla','ceba','onion'],['ajo','all','garlic'],['jamon','pernil','ham'],
 ['ensalada','amanida','salad'],['sopa','soup'],['pasta','macarrones','macarrons','macaroni'],['espaguetis','spaghetti'],
 ['espana','spain','espanya','espanola','espanol'],['italia','italy','italiana','italian'],['japon','japan','japonesa','japanese'],
 ['alemania','germany','alemana','german'],['china','chinese'],['corea','korea','korean'],['tailandia','thailand','thai'],
 ['estados unidos','usa','us','american'],['grecia','greece','greek'],['francia','france','french'],['paises bajos','holanda','netherlands','dutch'],
 ['pan con tomate','pa amb tomaquet','pan tumaca','pa amb tomaca'],['butifarra','botifarra'],['salmorejo','salmorejo cordobes']
];
export function searchTerms(query:string){
 const cleaned=normalizeProductText(query);
 return cleaned.split(' ').filter(x=>x.length>1&&!['con','de','del','amb','with','and','the','quiero','tengo','recetas','receta'].includes(x)).map(word=>{
  const group=groups.find(xs=>xs.some(x=>normalizeProductText(x)===word));
  return group?group.map(normalizeProductText):[word];
 });
}
export function matchesRecipeSearch(recipe:{title:string;description?:string;country?:string;ingredients:{name:string;key?:string}[]},query:string){
 const text=normalizeProductText([recipe.title,recipe.description||'',(recipe.country||'')+' '+recipeCountryLabel(recipe.country),...recipe.ingredients.map(i=>i.name+' '+(i.key||''))].join(' '));
 const terms=searchTerms(query);
 return terms.every(alternatives=>alternatives.some(term=>new RegExp('(?:^| )'+term+'(?:s|es)?(?: |$)').test(text)));
}
const countryLabels:Record<string,string>={spain:'España',germany:'Alemania',sushi:'Japón',japan:'Japón',pasta:'Italia',italy:'Italia',pizza:'Italia',burger:'Estados Unidos',china:'China',korea:'Corea',thailand:'Tailandia',india:'India',mexico:'México',france:'Francia',netherlands:'Países Bajos',greece:'Grecia',portugal:'Portugal',morocco:'Marruecos'};
export function recipeCountryLabel(country?:string){return country?countryLabels[country]||country:'Casera'}
