export type ReceiptCandidate={name:string;qty:number;price?:number;raw:string};
export type ReceiptParse={items:ReceiptCandidate[];total?:number;text:string};

const money=(s:string)=>Number(s.replace(".","").replace(",",".").replace(/[^0-9.]/g,""));

export function parseReceiptText(text:string):ReceiptParse{
 const lines=text.split(/\r?\n/).map(x=>x.replace(/\s+/g," ").trim()).filter(Boolean);
 let total:number|undefined;
 for(const line of lines){
  const m=line.match(/(?:TOTAL(?:\s+A\s+PAGAR)?|IMPORTE(?:\s+TOTAL)?)[^0-9]*(\d{1,4}[.,]\d{2})/i);
  if(m){const n=money(m[1]);if(Number.isFinite(n))total=n;}
 }
 const ignore=/(subtotal|\biva\b|base\s+imponible|tarjeta|efectivo|cambio|importe|total|ahorro|descuento|pago|fecha|hora|cajer|ticket|factura|nif|cif|tel[eé]fono|gracias|cliente|operaci[oó]n|autorizaci[oó]n|saldo|redondeo|donaci[oó]n)/i;
 const out:ReceiptCandidate[]=[];
 for(const raw of lines){
  if(ignore.test(raw))continue;
  const m=raw.match(/^(.{2,70}?)\s+(-?\d{1,4}[.,]\d{2})\s*(?:€|eur)?$/i);
  if(!m)continue;
  let name=m[1].replace(/^\d{5,14}\s+/,"").trim();
  const price=money(m[2]);
  if(!name||!Number.isFinite(price)||price<=0)continue;
  let qty=1;
  const qm=name.match(/^(\d+(?:[.,]\d+)?)\s*[xX]\s+(.+)$/);
  if(qm){qty=Number(qm[1].replace(",","."))||1;name=qm[2].trim();}
  name=name.replace(/^[-*#.:]+/,"").replace(/\s{2,}/g," ").trim();
  if(name.length<2||/^\d+$/.test(name))continue;
  out.push({name:name.charAt(0).toUpperCase()+name.slice(1).toLowerCase(),qty,price,raw});
 }
 const dedup:ReceiptCandidate[]=[];
 for(const item of out){
  const key=item.name.toLowerCase().replace(/[^a-z0-9áéíóúüñ]/g,"");
  const existing=dedup.find(x=>x.name.toLowerCase().replace(/[^a-z0-9áéíóúüñ]/g,"")===key);
  if(existing){existing.qty+=item.qty;existing.price=(existing.price||0)+(item.price||0);}
  else dedup.push({...item});
 }
 return {items:dedup.slice(0,80),total,text};
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
  return parseReceiptText(result.data.text||"");
 }finally{
  await worker.terminate();
 }
}
