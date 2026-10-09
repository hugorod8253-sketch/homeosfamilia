import {normalizePlanUnit} from './recipe-plan-engine';
import {normalizeProductText} from './product-engine';
export type QuickStockChoice={qty:number;unit:string;label:string};
/** Presets preserve the actual unit; a bunch/pack has no invented weight or piece count. */
export function quickStockChoices(name:string,unit:string):QuickStockChoice[]{
 const n=normalizeProductText(name),u=normalizePlanUnit(unit);
 if(u==='ud'&&/huevo|\bous\b/.test(n))return [6,12,24].map(qty=>({qty,unit:'uds',label:qty===6?'6 · media docena':qty===12?'12 · una docena':'24 · dos docenas'}));
 if(u==='ud'&&/platano|banana/.test(n))return [1,2,3].map(qty=>({qty,unit:'racimos',label:qty+' '+(qty===1?'racimo':'racimos')}));
 const numbers=u==='g'?[100,250,500,1000]:u==='ml'?[250,500,1000]:u==='kg'?[.5,1,2]:u==='L'?[1,2,4]:[1,2,3,4];
 return numbers.map(qty=>({qty,unit,label:qty+' '+unit}));
}
export function speechErrorMessage(error:string){
 if(error==='not-allowed'||error==='service-not-allowed')return 'El navegador ha bloqueado el micrófono. Permítelo o usa el dictado del teclado.';
 if(error==='audio-capture')return 'No se encuentra un micrófono. Comprueba que esté conectado.';
 if(error==='network')return 'El servicio de dictado del navegador no conecta. Puedes usar el micrófono del teclado o escribir la misma frase.';
 if(error==='no-speech')return 'No se ha recibido voz. Pulsa Dictar y habla cerca del micrófono.';
 return 'El dictado se ha interrumpido. El texto recibido queda disponible para añadirlo.';
}
