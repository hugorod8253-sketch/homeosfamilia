import { writeFileSync } from "node:fs";
import { ILLUSTRATED_PRODUCTS } from "../lib/illustrated-products";
import { classifyProduct } from "../lib/product-engine";

const groups = new Map<string, string[]>();
for (const name of ILLUSTRATED_PRODUCTS) {
 const category=classifyProduct(name).category;
 groups.set(category,[...(groups.get(category)||[]),name]);
}
let text = `# Catálogo ilustrado de HomeOS\n\n${ILLUSTRATED_PRODUCTS.length} productos registrados con una ilustración asociada. Incluye alimentación y las categorías de hogar ya existentes.\n\nLas marcas y formatos pueden compartir ilustración cuando el alimento y su presentación son equivalentes. La variedad o preparación visible tiene su propio dibujo. Este registro no acredita la disponibilidad de una marca o referencia comercial en un supermercado.\n`;
for (const [category,names] of groups) text += `\n## ${category} (${names.length})\n\n${names.join(", ")}\n`;
writeFileSync("CATALOGO_ALIMENTOS.md",text);
