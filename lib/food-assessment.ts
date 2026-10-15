import type { BarcodeProduct } from './barcode-product';

/** Transparent screening, not a medical safety assessment or an official certification. */
export function assessFood(product: BarcodeProduct) {
 if (product.kind !== 'food') return {status:'not-applicable' as const, score:null, reasons:['No es un alimento']};
 const n=product.nutritionPer100g;
 const required=['energy-kcal','sugars','saturated-fat','salt'];
 const missing=required.filter(k=>!Number.isFinite(n[k]));
 if(missing.length || !product.ingredients?.trim()) return {status:'insufficient-data' as const,score:null,reasons:[...missing.map(k=>'Falta '+k),...(!product.ingredients?.trim()?['Falta lista de ingredientes']:[])]};
 const clamp=(v:number)=>Math.max(0,Math.min(100,v));
 // Nutritional indicators use declared values per 100 g/ml; these are not disease-risk estimates.
 let score=85;
 score-=Math.min(25,n.sugars*1.1);
 score-=Math.min(20,n['saturated-fat']*2);
 score-=Math.min(20,n.salt*10);
 score-=Math.min(10,n['energy-kcal']/100);
 score+=Math.min(8,(n.fiber||0)*1.5);
 const additives=product.additives||[];
 // Presence alone does not establish harm: no blanket penalty for E numbers.
 const reasons=[`Azúcares: ${n.sugars} g`,`Saturadas: ${n['saturated-fat']} g`,`Sal: ${n.salt} g`,`Aditivos declarados: ${additives.length}; su presencia no implica toxicidad`];
 return {status:'estimated' as const,score:Math.round(clamp(score)),reasons};
}
