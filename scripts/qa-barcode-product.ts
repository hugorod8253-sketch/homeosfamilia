import assert from 'node:assert/strict';
import { lookupBarcode, normalizeBarcode, parseBarcodeProduct } from '../lib/barcode-product';

async function main() {
assert.equal(normalizeBarcode(' 3560070791460 '), '3560070791460');
assert.equal(normalizeBarcode('036000291452'), '036000291452');
assert.equal(normalizeBarcode('3560070791461'), undefined);
assert.equal(normalizeBarcode('https://example.org/3560070791460'), undefined);
const payload = { product: { code: '3560070791460', product_name_es: 'Prueba', ingredients_text: 'Leche',
  nutriscore_grade: 'b', nutriments: { proteins_100g: 0, salt_100g: 0.2, sugars_100g: -1, fat_100g: '7' } } };
const food = parseBarcodeProduct(payload, '3560070791460', 'food')!;
assert.equal(food.nutriScore, 'b'); assert.equal(food.nutritionPer100g.proteins, 0);
assert.equal(food.nutritionPer100g.sugars, undefined); assert.equal(food.nutritionPer100g.fat, undefined);
assert.ok(food.missing.includes('allergens')); // Unknown is never presented as allergen-free.
const beauty = parseBarcodeProduct(payload, '3560070791460', 'beauty')!;
assert.equal(beauty.nutriScore, undefined); assert.deepEqual(beauty.nutritionPer100g, {});
assert.equal(parseBarcodeProduct(payload, '036000291452', 'food'), undefined);
assert.equal(parseBarcodeProduct({ status: 0 }, '3560070791460', 'food'), undefined);
let requests = 0;
const fetcher: typeof fetch = async (url, init) => {
  requests++; assert.ok(String(url).includes('/api/v3/product/')); assert.equal(init?.credentials, 'omit');
  return new Response(JSON.stringify(payload));
};
assert.equal((await lookupBarcode('invalid', 'food', { fetcher })).status, 'invalid'); assert.equal(requests, 0);
assert.equal((await lookupBarcode('3560070791460', 'food', { fetcher })).status, 'found');
assert.equal((await lookupBarcode('3560070791460', 'food', { fetcher: async () => new Response('', { status: 404 }) })).status, 'not-found');
assert.equal((await lookupBarcode('3560070791460', 'food', { fetcher: async () => new Response('', { status: 429 }) })).status, 'unavailable');
assert.equal((await lookupBarcode('3560070791460', 'food', { fetcher: async () => { throw new Error('offline'); } })).status, 'unavailable');
console.log('PASS: barcode checksum, leading zeros, food/beauty separation, missing data, offline and rate-limit fallback');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
