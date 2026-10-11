export type ReceiptCandidate={name:string;qty:number;price?:number;raw:string;unit?:string};
export type ReceiptParse={items:ReceiptCandidate[];total?:number;text:string;confidence?:number;warnings?:string[]};

const money=(raw:string)=>{
 const s=raw.trim().replace(/[€\s]/g,"");
 const lastComma=s.lastIndexOf(","),lastDot=s.lastIndexOf(".");
 if(lastComma>=0&&lastDot>=0)return Number(s.replace(lastComma>lastDot?/\./g:/,/g,"").replace(",","."));
 return Number(s.replace(",","."));
};
const rounded=(n:number)=>Math.round(n*100)/100;
const irrelevant=/\b(?:subtotal|total|iva|base imponible|tarjeta|efectivo|cambio|importe|ahorro|descuento|descuent|oferta ahorr|pago|fecha|hora|cajer|ticket|factura|nif|cif|tel[eé]fono|gracias|cliente|operaci[oó]n|autorizaci[oó]n|saldo|redondeo|donaci[oó]n|devoluci[oó]n|reintegro|puntos|cupon|cup[oó]n|referencia|visa|mastercard|contactless)\b/i;

export function receiptWarnings(items:ReceiptCandidate[],total?:number,confidence?:number){
 const warnings:string[]=[];
 if(!items.length)warnings.push("No se han podido identificar productos con seguridad.");
 if(total===undefined)warnings.push("No se ha leído el total del ticket; introdúcelo manualmente.");
 if(typeof confidence==="number"&&confidence<65)warnings.push("La imagen tiene baja calidad de lectura. Comprueba nombres y cantidades.");
 const lineSum=rounded(items.reduce((n,x)=>n+(x.price||0),0));
 if(typeof total==="number"&&items.length&&Math.abs(total-lineSum)>Math.max(.15,total*.02))
  warnings.push("La suma de líneas ("+lineSum.toFixed(2)+" €) no coincide con el total ("+total.toFixed(2)+" €). Puede haber descuentos, envases o líneas omitidas.");
 return warnings;
}

export function parseReceiptText(text:string):ReceiptParse{
 const lines=text.split(/\r?\n/).map(x=>x.replace(/\s+/g," ").trim()).filter(Boolean);
 let total:number|undefined;
 for(const line of lines){
  if(/\b(?:subtotal|ahorro|descuento|total\s+iva)\b/i.test(line))continue;
  const match=line.match(/^\s*(?:TOTAL(?:\s+A\s+PAGAR|\s+TICKET|\s+COMPRA)?|IMPORTE(?:\s+TOTAL|\s+A\s+PAGAR)?|A\s+PAGAR)\s*[:€]?\s*(\d{1,5}(?:[.,]\d{3})*[.,]\d{2})\s*€?\s*$/i);
  if(match){const n=money(match[1]);if(Number.isFinite(n)&&n>=0)total=n;}
 }
 const out:ReceiptCandidate[]=[];
 for(const raw of lines){
  if(irrelevant.test(raw)||/^\s*(?:[-\d\s:/.,]+|[A-D]\s+\d{1,2}%?)$/i.test(raw))continue;
  const match=raw.match(/^(.{2,110}?)\s+(-?\d{1,5}(?:[.,]\d{3})*[.,]\d{2})\s*(?:€|eur|[A-D])?\s*$/i);
  if(!match)continue;
  let name=match[1].replace(/^\d{7,14}\s+/,"").trim();
  const price=money(match[2]);
  if(!name||!Number.isFinite(price)||price<=0||price>5000)continue;
  let qty=1,unit:string|undefined;
  const prefix=name.match(/^(\d{1,3}(?:[.,]\d{1,3})?)\s*(?:[x×*]\s*|(?:uds?|unid(?:ades)?|kg|g|l)\s+)(.+)$/i);
  if(prefix){
   const measured=prefix[0].match(/^\d+(?:[.,]\d+)?\s*(kg|g|l|uds?|unid(?:ades)?)\s/i);
   qty=Number(prefix[1].replace(",","."));
   if(measured)unit=/^kg$/i.test(measured[1])?"kg":/^g$/i.test(measured[1])?"g":/^l$/i.test(measured[1])?"L":"uds";
   name=prefix[2].trim();
  }
  name=name.replace(/^\d+\s*[x×*]\s*\d+[.,]\d{2}\s+/,"").trim();
  if(prefix)name=name.replace(/^\d+[.,]\d{2}\s+(?=[^\d])/,"").trim();
  name=name.replace(/^[-*#.:]+\s*/,"").replace(/\s+(?:[A-D]\s*)$/,"").trim();
  if(name.length<2||/^\d+(?:[.,]\d+)?$/.test(name)||!Number.isFinite(qty)||qty<=0||qty>1000)continue;
  out.push({name:name.charAt(0).toUpperCase()+name.slice(1).toLowerCase(),qty,price,raw,...(unit?{unit}:{})});
 }
 const dedup:ReceiptCandidate[]=[];
 for(const item of out){
  const key=item.name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"")+(item.unit||"");
  const same=dedup.find(x=>x.name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"")+(x.unit||"")===key);
  if(same){same.qty=rounded(same.qty+item.qty);same.price=rounded((same.price||0)+(item.price||0));same.raw+=" | "+item.raw;}
  else dedup.push({...item});
 }
 const items=dedup.slice(0,80);
 return {items,total,text,warnings:receiptWarnings(items,total)};
}

export function mergeReceiptCandidates(existing:ReceiptCandidate[],incoming:ReceiptCandidate[]){
 const normName=(s:string)=>s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"");
 const out=existing.map(x=>({...x}));
 for(const item of incoming){
  const key=normName(item.name);
  const exact=out.find(x=>normName(x.name)===key&&Math.abs(x.qty-item.qty)<.001&&Math.abs((x.price||0)-(item.price||0))<.01);
  if(exact)continue;
  const same=out.find(x=>normName(x.name)===key);
  if(same){
   same.qty=Math.round((same.qty+item.qty)*100)/100;
   if(typeof item.price==="number")same.price=Math.round(((same.price||0)+item.price)*100)/100;
   same.raw=[same.raw,item.raw].filter(Boolean).join(" | ");
  }else out.push({...item});
 }
 return out.slice(0,120);
}

export async function readReceiptImage(file:File,onProgress?:(pct:number)=>void):Promise<ReceiptParse>{
 if(!file.type.startsWith("image/"))throw new Error("image_required");
 const {createWorker}=await import("tesseract.js");
 const worker=await createWorker("spa",1,{logger:(m:any)=>{
  if(m?.status==="recognizing text"&&typeof m.progress==="number")onProgress?.(Math.round(m.progress*100));
 }});
 try{
  const result=await worker.recognize(file);
  const parsed=parseReceiptText(result.data.text||"");
  const confidence=typeof result.data.confidence==="number"?Math.round(result.data.confidence):undefined;
  return {...parsed,confidence,warnings:receiptWarnings(parsed.items,parsed.total,confidence)};
 }finally{
  await worker.terminate();
 }
}
