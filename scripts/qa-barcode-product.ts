import assert from 'node:assert/strict';
import { lookupBarcode, normalizeBarcode, parseBarcodeProduct } from '../lib/barcode-product';
import { scannedPackage } from '../lib/scanned-package';
import { normalizeState, addScannedProduct, completePurchase } from '../components/homeos';

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
assert.deepEqual(scannedPackage({packageSize:'6 x 125 g'}),{qty:750,unit:'g'});
assert.deepEqual(scannedPackage({packageSize:'1,5 L'}),{qty:1.5,unit:'L'});
assert.deepEqual(scannedPackage({packageSize:'33 cl'}),{qty:330,unit:'ml'});
assert.deepEqual(scannedPackage({packageSize:'6 unidades'}),{qty:1,unit:'paquete'});
assert.deepEqual(scannedPackage({packageSize:'0 g'}),{qty:1,unit:'paquete'});
const initial = normalizeState({profile:{onboardingDone:true}});
const commercial = {...food,name:'Yogur natural',packageSize:'6 x 125 g'};
const listed = addScannedProduct(initial,commercial,'shopping',2).state;
assert.equal(listed.inventory.length,0); assert.equal(listed.shopping[0].qty,1500);
assert.equal(addScannedProduct(listed,commercial,'shopping',1).state,listed);
const checked={...listed,shopping:listed.shopping.map(item=>({...item,status:'carrito' as const}))};
const bought=completePurchase(checked,[checked.shopping[0].id],3,'Lidl','2026-10-10');
assert.equal(bought.inventory[0].barcode,food.barcode);assert.equal(bought.inventory[0].purchasedAt,'2026-10-10');
const atHome=addScannedProduct(initial,commercial,'inventory',1,'Nevera').state;
assert.equal(atHome.spent,0);assert.equal(atHome.purchaseHistory.length,0);assert.equal(atHome.inventory[0].qty,750);
assert.equal(atHome.inventory[0].purchaseDateUnknown,true);assert.equal(atHome.inventory[0].expires,undefined);
assert.equal(addScannedProduct(atHome,commercial,'inventory',1).state,atHome);
assert.equal(addScannedProduct(atHome,commercial,'inventory',1,'',true).state.inventory.length,2);
const cosmetics=addScannedProduct(initial,beauty,'shopping',1).state;
const cosmeticsBought=completePurchase({...cosmetics,shopping:cosmetics.shopping.map(item=>({...item,status:'carrito' as const}))},[cosmetics.shopping[0].id],undefined,'Lidl','2026-10-10');
assert.equal(cosmeticsBought.inventory[0].category,'Higiene y cuidado');
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
