/** Read-only product lookup. Never writes to the user's inventory or shared catalog. */
export type ProductKind = 'food' | 'beauty';
export type BarcodeProduct = {
  barcode: string; kind: ProductKind; name: string; brand?: string; packageSize?: string;
  ingredients?: string; allergens: string[]; nutritionPer100g: Record<string, number>;
  nutriScore?: string; missing: string[];
  source: { name: string; url: string; license: 'ODbL-1.0'; fetchedAt: string };
};
export type LookupResult =
  | { status: 'found'; product: BarcodeProduct }
  | { status: 'invalid' | 'not-found' | 'unavailable'; message: string };

/** GTIN-8 / UPC-A / EAN-13 / GTIN-14, retaining leading zeros. */
export function normalizeBarcode(value: string): string | undefined {
  const code = value.trim().replace(/[\s-]/g, '');
  if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(code)) return;
  let sum = 0;
  for (let i = code.length - 2, weight = 3; i >= 0; i--, weight = weight === 3 ? 1 : 3)
    sum += Number(code[i]) * weight;
  return (10 - sum % 10) % 10 === Number(code.at(-1)) ? code : undefined;
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => v && typeof v === 'object' && !Array.isArray(v) ? v as Obj : {};
const str = (v: unknown): string | undefined => typeof v === 'string' && v.trim() ? v.trim() : undefined;
const hosts = { food: 'world.openfoodfacts.org', beauty: 'world.openbeautyfacts.org' };

export function parseBarcodeProduct(payload: unknown, barcode: string, kind: ProductKind, now = new Date()): BarcodeProduct | undefined {
  const root = obj(payload), p = obj(root.product);
  if (!Object.keys(p).length || root.status === 0 || root.status === 'failure') return;
  // Reject a different product rather than silently assigning its label to this barcode.
  if (p.code !== undefined && String(p.code) !== barcode) return;
  const name = str(p.product_name_es) ?? str(p.product_name) ?? str(p.product_name_en);
  if (!name) return;
  const ingredients = str(p.ingredients_text_es) ?? str(p.ingredients_text) ?? str(p.ingredients_text_en);
  const nutritionPer100g: Record<string, number> = {};
  if (kind === 'food') {
    const nutrients = obj(p.nutriments);
    for (const field of ['energy-kcal', 'proteins', 'carbohydrates', 'sugars', 'fat', 'saturated-fat', 'fiber', 'salt']) {
      const value = nutrients[`${field}_100g`];
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) nutritionPer100g[field] = value;
    }
  }
  const grade = kind === 'food' ? str(p.nutriscore_grade)?.toLowerCase() : undefined;
  return {
    barcode, kind, name, brand: str(p.brands), packageSize: str(p.quantity), ingredients,
    allergens: Array.isArray(p.allergens_tags) ? p.allergens_tags.filter((v): v is string => typeof v === 'string') : [],
    nutritionPer100g, nutriScore: grade && /^[a-e]$/.test(grade) ? grade : undefined,
    missing: [!ingredients ? 'ingredients' : '', kind === 'food' && !Object.keys(nutritionPer100g).length ? 'nutrition' : '',
      !Array.isArray(p.allergens_tags) ? 'allergens' : ''].filter(Boolean),
    source: { name: kind === 'food' ? 'Open Food Facts' : 'Open Beauty Facts',
      url: `https://${hosts[kind]}/product/${barcode}`, license: 'ODbL-1.0', fetchedAt: now.toISOString() },
  };
}

/** Explicit kind selection avoids extra requests and unsupported product categories. */
export async function lookupBarcode(value: string, kind: ProductKind, options: {
  fetcher?: typeof fetch; timeoutMs?: number;
} = {}): Promise<LookupResult> {
  const barcode = normalizeBarcode(value);
  if (!barcode) return { status: 'invalid', message: 'Revisa el código de barras.' };
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), options.timeoutMs ?? 8000);
  try {
    const response = await (options.fetcher ?? fetch)(`https://${hosts[kind]}/api/v3/product/${barcode}.json`, {
      signal: abort.signal, credentials: 'omit', headers: { Accept: 'application/json' },
    });
    if (response.status === 404) return { status: 'not-found', message: 'Producto no encontrado. Puedes añadirlo manualmente.' };
    if (!response.ok) return { status: 'unavailable', message: 'No se puede consultar ahora. Tu compra sigue disponible.' };
    const product = parseBarcodeProduct(await response.json(), barcode, kind);
    return product ? { status: 'found', product } : { status: 'not-found', message: 'No hay una ficha utilizable. Puedes añadirlo manualmente.' };
  } catch {
    return { status: 'unavailable', message: 'Sin conexión o consulta interrumpida. Puedes continuar manualmente.' };
  } finally { clearTimeout(timer); }
}
