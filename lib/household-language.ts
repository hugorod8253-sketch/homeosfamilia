/** Conservative local interpretation. A suggestion must be accepted before changing a routine. */
export function interpretHouseholdNote(text:string){
 const t=text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 if(!t.trim())return undefined;
 if(/t[uú]pp?er|tuper|fiambrera|comida de casa|menjar de casa|packed lunch/.test(t))return {presence:'variable' as const,label:'Lleva comida de casa: comer fuera no significa consumir menos de Casa.'};
 if(/a veces|algunas veces|depende|pero|unos dias|variable/.test(t))return {presence:'variable' as const,label:'Rutina variable: no asumimos que coma siempre dentro o fuera.'};
 if(/no (?:suele )?(?:comer|come) fuera|(?:come|comer|dina|menja) (?:siempre |habitualmente )?en casa|eats? at home/.test(t))return {presence:'casa' as const,label:'Suele comer en casa.'};
 if(/(?:come|comer|dina|menja) fuera|fuera entre semana|restaurant|restaurante|eats? out/.test(t))return {presence:'fuera_dia' as const,label:'Suele comer fuera durante el día.'};
 if(/solo.*fin(?:es)? de semana|nomes.*cap de setmana/.test(t))return {presence:'fines_semana' as const,label:'Suele estar en casa los fines de semana.'};
 return undefined;
}
export function weeklyBudgetToMonthly(amount:number){return Number.isFinite(amount)&&amount>0?Math.round(amount*52/12):0;}
