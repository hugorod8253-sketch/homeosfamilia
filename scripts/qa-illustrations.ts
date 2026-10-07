import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { ILLUSTRATED_PRODUCTS, productIllustration } from "../lib/illustrated-products";
import { classifyProduct } from "../lib/product-engine";

for (const name of ILLUSTRATED_PRODUCTS) {
 const illustration = productIllustration(name, classifyProduct(name).canonical);
 assert(illustration, `Missing illustration: ${name}`);
 assert(existsSync(`public/food-illustrations/atlas-${illustration.sheet}.webp`), `Missing asset for ${name}`);
 const bytes = readFileSync(`public/food-illustrations/atlas-${illustration.sheet}.webp`);
 assert(bytes.length > 100 && bytes.toString("ascii",0,4) === "RIFF" && bytes.toString("ascii",8,12) === "WEBP", `Invalid WebP for ${name}`);
}
for (const [a, b] of [
 ["patata", "patatas de bolsa"], ["sandía rayada", "sandía negra"],
 ["pavo", "pavo en lonchas"], ["hamburguesa de carne", "albóndigas frescas"],
 ["sal", "pimienta negra"], ["tomate cherry", "tomate en rama"],
 ["vinagre de vino", "vinagre de manzana"], ["brócoli", "coliflor"],
 ["pepino", "calabacín"], ["jamón serrano", "jamón en taquitos"]
]) {
 assert.notDeepEqual(productIllustration(a,classifyProduct(a).canonical),productIllustration(b,classifyProduct(b).canonical), `${a} / ${b} must differ`);
}
assert.equal(productIllustration("Vinagre de manzana Hacendado",classifyProduct("Vinagre de manzana Hacendado").canonical)?.name,"vinagre de manzana");
assert.equal(classifyProduct("Vinagre de manzana").category,"Despensa");
assert.equal(classifyProduct("hígado de pollo").location,"Nevera");
console.log(`Illustration coverage checked for ${ILLUSTRATED_PRODUCTS.length} products and distinct preparation/variety pairs.`);
