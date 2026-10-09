import type { BarcodeProduct } from './barcode-product';

/** Total contents per commercial pack. Unknown packages stay packages, never invented grams. */
export function scannedPackage(product: Pick<BarcodeProduct,'packageSize'>): { qty:number; unit:string } {
  const text = product.packageSize?.trim().toLowerCase().replace(',', '.').replace(/\s*[e℮]$/, '').trim() ?? '';
  const match = text.match(/^(?:(\d+)\s*[x×]\s*)?(\d+(?:\.\d+)?)\s*(kg|g|ml|cl|l)$/);
  if (!match) return { qty:1, unit:'paquete' };
  const qty = Number(match[1] ?? 1) * Number(match[2]);
  if (!Number.isFinite(qty) || qty <= 0 || qty > 100000) return { qty:1, unit:'paquete' };
  return { qty:match[3] === 'cl' ? qty * 10 : qty, unit:match[3] === 'cl' ? 'ml' : match[3] === 'l' ? 'L' : match[3] };
}

const allergens: Record<string,string> = {milk:'Leche',eggs:'Huevos',gluten:'Gluten',soybeans:'Soja',nuts:'Frutos de cáscara',peanuts:'Cacahuetes',fish:'Pescado',crustaceans:'Crustáceos',molluscs:'Moluscos',celery:'Apio',mustard:'Mostaza','sesame-seeds':'Sésamo','sulphur-dioxide-and-sulphites':'Sulfitos',lupin:'Altramuces'};
export function allergenLabel(tag: string) { const key = tag.replace(/^[a-z]{2}:/,''); return allergens[key] ?? key.replace(/-/g,' '); }
