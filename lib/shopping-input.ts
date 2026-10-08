export function normalizeSpokenShoppingText(value: string) {
  const words: Record<string,string> = {un:"1",una:"1",uno:"1",dos:"2",tres:"3",cuatro:"4",cinco:"5",seis:"6",siete:"7",ocho:"8",nueve:"9",diez:"10",once:"11",doce:"12"};
  let out = value.replace(/[.!?]+/g, " ");
  for (const [word, number] of Object.entries(words)) out = out.replace(new RegExp("\\b" + word + "\\b", "gi"), number);
  out=out.replace(/\bperito\b/gi,"frito");
  out=out.replace(/\bpasta\s+para\s+(macarrones|espaguetis|espaguetti)\b/gi, "$1");
  out=out.replace(/^\s*(?:(?:necesito|necesitamos|quiero|queremos|hay que|apunta|añade|añadir|agrega|agregar|comprar|luego)\s+)+/i, "");
  return out.replace(/\bmedio\s+(kilo|kg|litro|l)\b/gi,(_,unit)=>"0,5 " + unit).replace(/\bmedia\s+docena\b/gi,"6 uds").replace(/[ \t]+/g," ").trim();
}

export function splitShoppingEntries(value: string) {
  let source=normalizeSpokenShoppingText(value);
  source=source.replace(/\b(?:y\s+)?(?:luego\s+)?(?:comprar|añadir|agregar)\s+/gi," y ");
  const raw=source.split(/(?<!\d),|,(?!\d)|;|\n|\s+y\s+/i).flatMap(entry=>{
    const clean=entry.trim().replace(/^\s*(?:necesito|quiero|comprar|añadir|agregar)\s+/i,"");
    const withCon=clean.match(/^(.+?)\s+con\s+(.+)$/i);
    return withCon?[withCon[1],withCon[2]]:[clean];
  });
  return raw.map(entry=>entry.trim().replace(/\s+/g," ")).filter(Boolean).slice(0,12);
}

export function parseShoppingQuantity(input: string) {
  let name = normalizeSpokenShoppingText(input.trim()), qty = 1, unit = "ud";
  const measured = name.match(/(\d+(?:[.,]\d+)?)\s*(kg|kilos?|g|gramos?|l|litros?|ml|mililitros?|uds?|unidades?|rollos?|packs?|paquetes?|bricks?)\b/i);
  if (measured) {
    qty = Number(measured[1].replace(",","."));
    const raw = measured[2].toLowerCase();
    unit = raw === "l" || raw.startsWith("litro") ? "L" : raw === "kg" || raw.startsWith("kilo") ? "kg" : raw === "g" || raw.startsWith("gramo") ? "g" : raw === "ml" || raw.startsWith("mililitro") ? "ml" : raw.startsWith("ud") || raw.startsWith("unidad") ? "uds" : raw.startsWith("rollo") ? "rollos" : raw.startsWith("brick") ? "bricks" : "pack";
    name = name.replace(measured[0]," ");
  } else {
    const count = name.match(/^(\d+(?:[.,]\d+)?)\s+(.+)$/);
    if (count) { qty = Number(count[1].replace(",",".")); unit = "uds"; name = count[2]; }
  }
  name = name.replace(/^\s*de\s+/i,"").replace(/[ \t]+/g," ").trim();
  return { name, qty, unit };
}

/** Do not turn conversation or correction commentary into groceries. */
export function shoppingInputNeedsReview(value:string){
 return /\b(?:escrito mal|hemos puesto|te equivocas|no se tiene que|no se vaya|como analizar|como funciona|lo otro|no lo borres|quita|borrar|elimina|cancelar|sustituye|cambia)\b/i.test(value)||value.trim().split(/\s+/).length>18;
}
