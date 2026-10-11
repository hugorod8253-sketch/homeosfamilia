export function normalizeSpokenShoppingText(value: string) {
  const words: Record<string,string> = {un:"1",una:"1",uno:"1",dos:"2",tres:"3",cuatro:"4",cinco:"5",seis:"6",siete:"7",ocho:"8",nueve:"9",diez:"10",once:"11",doce:"12"};
  let out = value.replace(/[.!?]+/g, " ");
  for (const [word, number] of Object.entries(words)) out = out.replace(new RegExp("\\b" + word + "\\b", "gi"), number);
  out=out.replace(/\b(?:necesito|necesitamos|quiero|queremos|voy a|vamos a)\s+(?:ir\s+)?(?:al\s+)?(?:supermercado|s[uú]per|tienda)\s+(?:a\s+)?(?:comprar\s+)?/gi, "");
  out=out.replace(/\bbriks?\b/gi,m=>m.toLowerCase().endsWith("s")?"bricks":"brick");
  // Remove conversational glue without swallowing actual product descriptions.
  out=out.replace(/\b(?:tengo que|tenemos que|voy a|vamos a|hay que)\s+(?:ir a(?:l supermercado| la tienda)?\s+a\s+)?(?:comprar|apuntar|añadir)\b/gi," y ");
  out=out.replace(/\b(?:me falta|nos falta|me hacen falta|nos hacen falta|hace falta|necesito que compres|necesitamos que compres)\b/gi," y ");
  out=out.replace(/\b(?:oye|mira|pues|vale|por favor|apúntame|apunta|apúntanos|anota|anótame)\b/gi," ");
  out=out.replace(/\b(?:pon|mete|añade|agrega)\s+(?:en|a)\s+la\s+(?:compra|lista)\b/gi," y ");
  out=out.replace(/\b(?:también\s+)?(?:necesitamos|necesito|queremos|quiero)\s+(?:comprar|añadir|apuntar)\b/gi," y ");
  out=out.replace(/\b(?:también\s+)?(?:necesitamos|necesito|queremos|quiero)\b/gi," y ");
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
    const clean=entry.trim()
      .replace(/^(?:(?:necesito|quiero|comprar|añadir|agregar|también|además|después|luego|por favor|y|de|el|la)\s+)+/i,"")
      .replace(/\s+(?:por favor|para la compra)$/i,"").trim();
    const withCon=clean.match(/^(.+?)\s+con\s+(.+)$/i);
    return withCon?[withCon[1],withCon[2]]:[clean];
  });
  const output=raw.map(entry=>entry.trim().replace(/^(?:y\s+)+/i,"").replace(/\s+/g," ")).filter(Boolean);
  return output.filter((item,index)=>output.findIndex(v=>v.toLocaleLowerCase("es")===item.toLocaleLowerCase("es"))===index).slice(0,50);
}

export function parseShoppingQuantity(input: string) {
  let name = normalizeSpokenShoppingText(input.trim()), qty = 1, unit = "ud";
  const measured = name.match(/(\d+(?:[.,]\d+)?)\s*(kg|kilos?|g|gramos?|l|litros?|ml|mililitros?|uds?|unidades?|rollos?|packs?|paquetes?|bricks?|botes?|botellas?|latas?|tarros?|bandejas?|bolsas?|cajas?)\b/i);
  if (measured) {
    qty = Number(measured[1].replace(",","."));
    const raw = measured[2].toLowerCase();
    unit = raw === "l" || raw.startsWith("litro") ? "L" : raw === "kg" || raw.startsWith("kilo") ? "kg" : raw === "g" || raw.startsWith("gramo") ? "g" : raw === "ml" || raw.startsWith("mililitro") ? "ml" : raw.startsWith("ud") || raw.startsWith("unidad") ? "uds" : raw.startsWith("rollo") ? "rollos" : raw.startsWith("brick") ? "bricks" : raw.startsWith("botella") ? "botellas" : raw.startsWith("bote") ? "botes" : raw.startsWith("lata") ? "latas" : raw.startsWith("tarro") ? "tarros" : raw.startsWith("bandeja") ? "bandejas" : raw.startsWith("bolsa") ? "bolsas" : raw.startsWith("caja") ? "cajas" : "pack";
    name = name.replace(measured[0]," ");
  } else {
    const count = name.match(/^(\d+(?:[.,]\d+)?)\s+(.+)$/);
    if (count) { qty = Number(count[1].replace(",",".")); unit = "uds"; name = count[2]; }
  }
  if(unit==="ud"||unit==="uds"){if(/^leche(?:\s|$)|^llet(?:\s|$)/i.test(name))unit="bricks";}
  name = name.replace(/^\s*(?:(?:de|del|el|la|los|las)\s+)+/i,"").replace(/[ \t]+/g," ").trim();
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
 if(!match||(!match[1]&&!/\b(?:nevera|congelador|despensa)\b/i.test(value.slice(match.index))))return {shopping:splitShoppingEntries(value),home:[]};
 if(/^pon\s+en\s+la\s+compra\b/i.test(value.slice(match.index)))return {shopping:splitShoppingEntries(value),home:[]};
 const before=value.slice(0,match.index),after=value.slice(match.index+match[0].length).trim();
 const location=/congelador/i.test(match[1]||after)?'Congelador' as const:/despensa/i.test(match[1]||after)?'Despensa' as const:'Nevera' as const;
 const name=after.replace(/\s+(?:en|a)\s+(?:la |el )?(?:nevera|congelador|despensa).*$/i,'').trim();
 const prepared=/raciones?|porciones?|tuppers?|sobras?|cocinad|preparad|\b(?:pasta|macarrones|arroz|pollo|sopa|lentejas)\s+con\s+/i.test(name);
 return {shopping:splitShoppingEntries(before),home:name?[{text:name+' en '+location,name,kind:prepared?'prepared':'stock',location}]:[]};
}
