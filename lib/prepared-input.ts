import {normalizeSpokenShoppingText} from './shopping-input';
export function parsePreparedInput(text:string){
 const spoken=normalizeSpokenShoppingText(text).trim();
 const portions=spoken.match(/(\d+)\s*(?:raciones?|porciones?|tuppers?|tuperes)/i);
 const days=spoken.match(/(\d+)\s*d[ií]as?/i);
 const location=/congela/i.test(spoken)?'Congelador' as const:'Nevera' as const;
 let name=spoken.replace(/^(?:(?:a mi |a mí )?(?:me |nos )?(?:ha|han|he|hemos)\s+(?:sobrado|preparado|cocinado)|sobraron|sobr[oó]|guardo|dejo|congelo)\s*/i,'')
 .replace(/^(?:meal\s*prep\s*(?:de)?\s*)/i,'')
 .replace(/\b\d+\s*(?:raciones?|porciones?|tuppers?|tuperes)\s*(?:de\s+)?/i,'')
 .replace(/\s+(?:[,;.]?\s*(?:y\s+)?(?:(?:las?|los|lo)\s+)?(?:(?:van|va|voy a guardar|voy a meter|guardo|dejo|pongo)\s+)?(?:en|a|al|para)\s+(?:la |el )?(?:nevera|congelador).*)$/i,'')
 .replace(/\s+(?:para|durante)\s+\d+\s*d[ií]as?.*$/i,'')
 .replace(/^de\s+/i,'').replace(/[.,;!?]+$/,'').trim();
 if(!name)name='Comida preparada';
 return {name:name.charAt(0).toUpperCase()+name.slice(1),servings:portions?Math.max(1,Number(portions[1])):1,location,days:days?Math.max(1,Math.min(14,Number(days[1]))):undefined,mealprep:/meal\s*prep/i.test(spoken)};
}
