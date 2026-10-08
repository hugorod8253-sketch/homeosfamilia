type Recipe={id:string;title:string;description:string;image:string;ingredients:{name:string}[];mealTypes?:string[]};
const norm=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function dailyIdeas<T extends {r:Recipe}>(ranked:T[]){
 const chosen:Array<T&{slot:string}>=[];
 for(const slot of ['Desayuno','Comida','Cena']){
  const candidates=ranked.filter(({r})=>{
   if(chosen.some(x=>x.r.id===r.id))return false;
   const text=norm(r.title+' '+r.description);
   if(slot==='Desayuno')return !/postre|brownie|mug cake|platano con chocolate/.test(text)&&(/desayuno|tostada|tortitas|batido|avena|sandwich/.test(text)||r.mealTypes?.includes(slot))&&r.ingredients.some(i=>/huevo|yogur|queso|leche|pavo|tofu|proteina/.test(norm(i.name)));
   return r.mealTypes?.includes(slot)||(!r.mealTypes?.length&&!/postre|desayuno|batido|tortitas|chocolate/.test(text));
  });
  const next=candidates.find(x=>!chosen.some(y=>y.r.image===x.r.image))||candidates[0];
  if(next)chosen.push({...next,slot});
 }
 return chosen;
}
