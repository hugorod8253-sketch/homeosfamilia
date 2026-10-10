export function normalizeSpokenShoppingText(value: string) {
  const words: Record<string,string> = {un:"1",una:"1",uno:"1",dos:"2",tres:"3",cuatro:"4",cinco:"5",seis:"6",siete:"7",ocho:"8",nueve:"9",diez:"10",once:"11",doce:"12"};
  let out = value.replace(/[.!?]+/g, " ");
  for (const [word, number] of Object.entries(words)) out = out.replace(new RegExp("\\b" + word + "\\b", "gi"), number);
  out=out.replace(/\b(?:necesito|necesitamos|quiero|queremos|voy a|vamos a)\s+(?:ir\s+)?(?:al\s+)?(?:supermercado|s[uú]per|tienda)\s+(?:a\s+)?(?:comprar\s+)?/gi, "");
  out=out.replace(/\bbriks?\b/gi,m=>m.toLowerCase().endsWith("s")?"bricks":"brick");
  out=out.replace(/\bperito\b/gi,"frito");
  out=out.replace(/\bpasta\s+para\s+(macarrones|espaguetis|espaguetti)\b/gi, "$1");
  // Voice requests often contain the reason for the purchase. Keep the foods
  // around the connectors and discard the conversational glue.
  out=out.replace(/\b(?:también\s+)?para\s+(?:luego\s+)?(?:hacer|cenar|comer|preparar)\b/gi," y ");
  out=out.replace(/\b(?:y\s+)?luego\s+para\s+(?:hacer|cenar|comer|preparar)\b/gi," y ");
  out=out.replace(/\b(?:también\s+)?para\s+luego\b/gi," y ");
  out=out.replace(/^\s*(?:(?:necesito|necesitamos|quiero|queremos|hay que|apunta|añade|añadir|agrega|agregar|comprar|luego)\s+)+/i, "");
  return out.replace(/\bmedio\s+(kilo|kg|litro|l)\b/gi,(_,unit)=>"0,5 " + unit).replace(/\bmedia\s+docena\b/gi,"6 uds").replace(/\by\s+y\b/gi,"y").replace(/[ \t]+/g," ").trim();
}

export function splitShoppingEntries(value: string) {
  let source=normalizeSpokenShoppingText(value);
  source=source.replace(/\b(?:y\s+)?(?:luego\s+)?(?:comprar|añadir|agregar)\s+/gi," y ");
  const raw=source.split(/(?<!\d),|,(?!\d)|;|\n|\s+y\s+/i).flatMap(entry=>{
    const clean=entry.trim().replace(/^\s*(?:necesito|quiero|comprar|añadir|agregar)\s+/i,"");
    const withCon=clean.match(/^(.+?)\s+con\s+(.+)$/i);
    return withCon?[withCon[1],withCon[2]]:[clean];
  });
  return raw.map(entry=>entry.trim().replace(/^(?:y\s+)+/i,"").replace(/\s+/g," ")).filter(Boolean).slice(0,50);
}

export function parseShoppingQuantity(input: string) {
  let name = normalizeSpokenShoppingText(input.trim()), qty = 1, unit = "ud";
  const measured = name.match(/(\d+(?:[.,]\d+)?)\s*(kg|kilos?|g|gramos?|l|litros?|ml|mililitros?|uds?|unidades?|rollos?|packs?|paquetes?|bricks?|botes?|botellas?)\b/i);
  if (measured) {
    qty = Number(measured[1].replace(",","."));
    const raw = measured[2].toLowerCase();
    unit = raw === "l" || raw.startsWith("litro") ? "L" : raw === "kg" || raw.startsWith("kilo") ? "kg" : raw === "g" || raw.startsWith("gramo") ? "g" : raw === "ml" || raw.startsWith("mililitro") ? "ml" : raw.startsWith("ud") || raw.startsWith("unidad") ? "uds" : raw.startsWith("rollo") ? "rollos" : raw.startsWith("brick") ? "bricks" : raw.startsWith("botella") ? "botellas" : raw.startsWith("bote") ? "botes" : "pack";
    name = name.replace(measured[0]," ");
  } else {
    const count = name.match(/^(\d+(?:[.,]\d+)?)\s+(.+)$/);
    if (count) { qty = Number(count[1].replace(",",".")); unit = "uds"; name = count[2]; }
  }
  if(unit==="ud"||unit==="uds"){if(/^leche(?:\s|$)|^llet(?:\s|$)/i.test(name))unit="bricks";}
  name = name.replace(/^\s*de\s+/i,"").replace(/[ \t]+/g," ").trim();
  return { name, qty, unit };
}

/** Do not turn conversation or correction commentary into groceries. */
export function shoppingInputNeedsReview(value:string){
 return /\b(?:no comprar|no compres|no quiero|no necesito|escrito mal|hemos puesto|te equivocas|no se tiene que|no se vaya|como analizar|como funciona|lo otro|no lo borres|quita|borrar|elimina|cancelar|sustituye|cambia)\b/i.test(value);
}

export type HomeStatement={text:string;name:string;kind:'prepared'|'stock';location:'Nevera'|'Congelador'|'Despensa'};
/** Separate different intentions. Never silently turn a statement about Casa into a purchase. */
export function interpretShoppingRequest(value:string):{shopping:string[];home:HomeStatement[]}{
 const marker=/\b(?:y\s+)?(?:(?:luego|despu[eé]s)\s+)?(?:a\s+)?(?:voy a |vamos a |quiero |necesito )?(?:meter|guardar|poner|dejar|mete|guarda|pon|deja)\s+(?:(?:en|a)\s+(?:la |el )?(nevera|congelador|despensa)\s+)?/i;
 const match=marker.exec(value);
 if(!match)return {shopping:splitShoppingEntries(value),home:[]};
 const before=value.slice(0,match.index),after=value.slice(match.index+match[0].length).trim();
 const location=/congelador/i.test(match[1]||after)?'Congelador' as const:/despensa/i.test(match[1]||after)?'Despensa' as const:'Nevera' as const;
 const name=after.replace(/\s+(?:en|a)\s+(?:la |el )?(?:nevera|congelador|despensa).*$/i,'').trim();
 const prepared=/raciones?|porciones?|tuppers?|sobras?|cocinad|preparad|\b(?:pasta|macarrones|arroz|pollo|sopa|lentejas)\s+con\s+/i.test(name);
 return {shopping:splitShoppingEntries(before),home:name?[{text:name+' en '+location,name,kind:prepared?'prepared':'stock',location}]:[]};
}
