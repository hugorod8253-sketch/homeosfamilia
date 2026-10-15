import type { BarcodeProduct } from './barcode-product';
import { scannedPackage } from './scanned-package';

export type FoodAssessment = {status:'estimated'|'insufficient-data'|'not-applicable';reasons:string[];warnings:string[];evidence:string[]};

export function sugarPerPackage(product:BarcodeProduct):{grams:number;quantity:number;unit:'g'|'ml'}|undefined {
 const sugar=product.nutritionPer100g?.sugars, pack=scannedPackage({packageSize:product.packageSize});
 if(!Number.isFinite(sugar)||!pack||!['g','ml','L'].includes(pack.unit))return;
 const unit=product.nutritionBasis==='100 ml'?'ml':'g';
 const quantity=pack.unit==='L'?pack.qty*1000:pack.qty;
 if((unit==='ml'&&pack.unit==='g')||(unit==='g'&&pack.unit!=='g'))return;
 return {grams:Math.round((sugar as number)*quantity/100*100)/100,quantity,unit};
}

/** Shows only declared facts. HomeOS does not infer a universal health grade. */
export function assessFood(product:BarcodeProduct):FoodAssessment {
 if(product.kind!=='food')return {status:'not-applicable',reasons:['No es un alimento'],warnings:[],evidence:[]};
 const n=product.nutritionPer100g||{}, ingredients=product.ingredients?.trim()||'';
 const required=['energy-kcal','sugars','saturated-fat','salt'];
 const missing=required.filter(k=>!Number.isFinite(n[k]));
 if(!ingredients||missing.length)return {status:'insufficient-data',reasons:[...missing.map(k=>'Falta '+k),...(!ingredients?['Falta lista de ingredientes']:[])],warnings:['No podemos completar el análisis con los datos disponibles.'],evidence:[]};
 const warnings:string[]=[];
 if(/\b(cafe[ií]na|caffeine|guaran[aá]|yerba mate)\b/i.test(ingredients))warnings.push('Contiene ingredientes asociados a cafeína: revisa la cantidad declarada y el envase.');
 if(/\b(az[uú]car|sugar|jarabe de glucosa|glucose syrup|dextrosa)\b/i.test(ingredients))warnings.push('Se declaran azúcares o jarabes en ingredientes; la lista se ordena por peso.');
 const additives=product.additives||[];
 if(additives.length)warnings.push('Aditivos declarados: su presencia no demuestra riesgo; consulta la ficha y las condiciones de uso.');
 if(/\b(?:eco|ecol[oó]gic[oa]|organic|bio)\b/i.test(product.name+' '+(product.categoryText||'')))warnings.push('La denominación ecológica no acredita por sí sola una composición nutricional mejor.');
 const evidence=[`Energía: ${n['energy-kcal']} kcal / ${product.nutritionBasis}`,`Azúcares: ${n.sugars} g`,`Grasas saturadas: ${n['saturated-fat']} g`,`Sal: ${n.salt} g`,`Aditivos identificados: ${additives.length}`];
 return {status:'estimated',reasons:['Datos declarados por cada 100 g o 100 ml; no son una nota de salud ni una recomendación.'],warnings,evidence};
}
