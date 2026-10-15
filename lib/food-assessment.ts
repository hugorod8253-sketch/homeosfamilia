import type { BarcodeProduct } from './barcode-product';

export type FoodAssessment = {status:'estimated'|'insufficient-data'|'not-applicable';score:number|null;reasons:string[];warnings:string[];evidence:string[]};
/** Transparent product screening, NOT a medical assessment or official certification.
 * A score is shown only with ingredient and core nutrient declarations. */
export function assessFood(product:BarcodeProduct):FoodAssessment {
 if(product.kind!=='food')return {status:'not-applicable',score:null,reasons:['No es un alimento'],warnings:[],evidence:[]};
 const n=product.nutritionPer100g||{}, ingredients=product.ingredients?.trim()||'';
 const required=['energy-kcal','sugars','saturated-fat','salt'];
 const missing=required.filter(k=>!Number.isFinite(n[k]));
 if(!ingredients||missing.length)return {status:'insufficient-data',score:null,reasons:[...missing.map(k=>'Falta '+k),...(!ingredients?['Falta lista de ingredientes']:[])],warnings:['No podemos emitir una valoración completa con datos incompletos.'],evidence:[]};
 const isDrink=product.nutritionBasis==='100 ml';
 const sugar=n.sugars, salt=n.salt, saturated=n['saturated-fat'], energy=n['energy-kcal'];
 const sugarHigh=isDrink?sugar>11.25:sugar>22.5;
 const saltHigh=salt>1.5, saturatedHigh=saturated>5;
 const warnings:string[]=[];
 if(sugarHigh)warnings.push('Azúcares totales elevados por '+product.nutritionBasis+'; no distingue los añadidos');
 if(saltHigh)warnings.push('Sal elevada por '+product.nutritionBasis);
 if(saturatedHigh)warnings.push('Grasas saturadas elevadas por '+product.nutritionBasis);
 if(/\b(cafe[ií]na|caffeine|guaran[aá]|yerba mate)\b/i.test(ingredients))warnings.push('Contiene ingredientes asociados a cafeína: revisar dosis y población destinataria');
 if(/\b(az[uú]car|sugar|jarabe de glucosa|glucose syrup|dextrosa)\b/i.test(ingredients))warnings.push('Se declaran azúcares o jarabes en ingredientes; su posición indica orden por peso');
 const additives=product.additives||[];
 if(additives.length)warnings.push('Aditivos declarados: consulta la ficha y las condiciones de uso; su presencia no demuestra riesgo');
 if(/\\b(?:eco|ecol[oó]gic[oa]|organic|bio)\\b/i.test(product.name+' '+(product.categoryText||'')))warnings.push('La denominación ecológica no acredita por sí sola una mejor composición nutricional; verifica el sello oficial del envase');
 const evidence=[`Energía: ${energy} kcal / ${product.nutritionBasis}`,`Azúcares: ${sugar} g`,`Grasas saturadas: ${saturated} g`,`Sal: ${salt} g`,`Aditivos identificados: ${additives.length}`];
 // This is a provisional transparent nutrition index, not a toxicity score.
 let score=85-Math.min(25,sugar*1.1)-Math.min(20,saturated*2)-Math.min(20,salt*10)-Math.min(10,energy/100)+Math.min(8,(n.fiber||0)*1.5);
 score=Math.round(Math.max(0,Math.min(100,score)));
 return {status:'estimated',score,reasons:['Índice nutricional orientativo, no diagnóstico ni certificado de seguridad','Los aditivos autorizados no se consideran dañinos solo por estar presentes'],warnings,evidence};
}
