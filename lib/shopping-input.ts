export function normalizeSpokenShoppingText(value: string) {
  const words: Record<string,string> = {un:"1",una:"1",uno:"1",dos:"2",tres:"3",cuatro:"4",cinco:"5",seis:"6",siete:"7",ocho:"8",nueve:"9",diez:"10",once:"11",doce:"12"};
  let out = value;
  for (const [word, number] of Object.entries(words)) out = out.replace(new RegExp("\\b" + word + "\\b", "gi"), number);
  out=out.replace(/^\s*(?:(?:necesito|necesitamos|quiero|queremos|hay que|apunta|añade|añadir|agrega|agregar|comprar)\s+)+/i, "");
  out=out.replace(/\bpasta\s+para\s+(macarrones|espaguetis|espaguetti)\b/gi, "$1");
  return out.replace(/\bmedio\s+(kilo|kg|litro|l)\b/gi,(_,unit)=>"0,5 " + unit).replace(/\bmedia\s+docena\b/gi,"6 uds");
}

export function splitShoppingEntries(value: string) {
  // A comma between digits is a decimal separator, not another product.
  return value.split(/(?<!\d),|,(?!\d)|;|\n|\s+y\s+/i).map(entry => entry.trim().replace(/\s+/g," ")).filter(Boolean).slice(0,12);
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
  name = name.replace(/^\s*de\s+/i,"").replace(/\s+/g," ").trim();
  return { name, qty, unit };
}
