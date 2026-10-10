import { normalizeBarcode, type BarcodeProduct } from './barcode-product';

export type ProductFactsItem = { barcode?: string; productInfo?: BarcodeProduct };

/** A generic name never inherits a branded product's nutrition or allergens. */
export function storedProductFacts(item: ProductFactsItem): BarcodeProduct | undefined {
  const p = item.productInfo;
  const code = typeof item.barcode === 'string' ? normalizeBarcode(item.barcode) : undefined;
  if (!code || !p || typeof p.barcode !== 'string' ||
      p.barcode.padStart(14,'0') !== code.padStart(14,'0') ||
      !['food','beauty'].includes(p.kind) || typeof p.name !== 'string' || !p.name.trim()) return;
  const host = p.kind === 'food' ? 'world.openfoodfacts.org' : 'world.openbeautyfacts.org';
  if (!p.source || p.source.url !== `https://${host}/product/${p.barcode}` ||
      typeof p.source.name !== 'string' || p.source.license !== 'ODbL-1.0' ||
      !Number.isFinite(Date.parse(p.source.fetchedAt)) ||
      (p.brand!==undefined&&typeof p.brand!=='string') ||
      (p.packageSize!==undefined&&typeof p.packageSize!=='string') ||
      (p.ingredients!==undefined&&typeof p.ingredients!=='string') ||
      !['100 g','100 ml'].includes(p.nutritionBasis) ||
      !Array.isArray(p.allergens) || !p.allergens.every(x=>typeof x==='string') ||
      !Array.isArray(p.additives) || !p.additives.every(x=>typeof x==='string') ||
      !p.nutritionPer100g || typeof p.nutritionPer100g!=='object' || Array.isArray(p.nutritionPer100g) ||
      !Object.values(p.nutritionPer100g).every(x=>typeof x==='number'&&Number.isFinite(x)&&x>=0)) return;
  return {...p,nutriScore:p.kind==='food'&&/^[a-e]$/.test(p.nutriScore||'')?p.nutriScore:undefined};
}

/** A dated snapshot stays readable offline; old grades ask for a refresh. */
export function nutritionRating(product: BarcodeProduct | undefined, now = Date.now()): string | undefined {
  if (!product || product.kind !== 'food' || !/^[a-e]$/.test(product.nutriScore||'')) return;
  const age = now - Date.parse(product.source.fetchedAt);
  return Number.isFinite(age) && age >= -86400000 && age <= 30*86400000 ? product.nutriScore : undefined;
}
