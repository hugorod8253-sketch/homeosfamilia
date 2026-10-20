import {calendarDaysUntil,isCalendarDate,localDateIso} from './local-date';
export type QuickLevel='queda'|'bastante'|'mitad'|'poco';
export type AutoPrepared={qty:number;servings?:number;stock:string;source?:string;location:string;mealPrepAuto?:boolean;mealPrepAutoStart?:string;mealPrepAutoQty?:number;mealPrepAutoDays?:number;mealPrepAutoApplied?:number;mealPrepAutoDepleted?:boolean};
/** A qualitative observation never invents grams, pieces or a confirmed count. */
export function observeStock<T extends {qty:number;stock:string;lastConfirmedAt?:string}>(item:T,level:QuickLevel,today=localDateIso()):T&{quickLevel:QuickLevel;quickObservedAt:string}{
 return {...item,stock:level==='poco'?'poco':item.qty>0?'hay':'incierto',quickLevel:level,quickObservedAt:today,lastConfirmedAt:undefined} as T&{quickLevel:QuickLevel;quickObservedAt:string};
}
export function startAutoPrepared<T extends AutoPrepared>(item:T,days:number,today=localDateIso()):T&AutoPrepared{
 const qty=Math.max(0,item.servings??item.qty);
 return {...item,mealPrepAuto:true,mealPrepAutoStart:today,mealPrepAutoQty:qty,mealPrepAutoDays:Math.max(1,Math.min(30,Math.round(days))),mealPrepAutoApplied:0,mealPrepAutoDepleted:false};
}
/** A consumption plan is a forecast, not evidence that portions were eaten.
 * Only an explicit meal, discard or inventory recount may change stock. */
export function estimatePreparedRemaining(item:AutoPrepared,today=localDateIso()){
 if(!item.mealPrepAuto||item.source!=="mealprep"||item.location==="Congelador"||!item.mealPrepAutoStart||!isCalendarDate(item.mealPrepAutoStart)||!isCalendarDate(today)||!item.mealPrepAutoDays||!Number.isFinite(item.mealPrepAutoQty))return null;
 const days=Math.max(1,item.mealPrepAutoDays);
 const elapsed=Math.max(0,-calendarDaysUntil(item.mealPrepAutoStart,new Date(today+"T12:00:00")));
 const initial=Math.max(0,item.mealPrepAutoQty||0);
 return {estimatedQty:Math.min(Math.max(0,item.servings??item.qty),Math.max(0,initial-Math.floor(initial*Math.min(elapsed,days)/days))),daysRemaining:Math.max(0,days-elapsed)};
}
/** Legacy entry point. Stop persisting predictions as confirmed consumption. */
export function advanceAutoPrepared<T extends AutoPrepared>(item:T,_today=localDateIso()):T{
 return item;
}
export function remainingAutoDays(item:AutoPrepared,today=localDateIso()){
 const elapsed=item.mealPrepAutoStart&&isCalendarDate(item.mealPrepAutoStart)?Math.max(0,-calendarDaysUntil(item.mealPrepAutoStart,new Date(today+'T12:00:00'))):0;
 return Math.max(1,(item.mealPrepAutoDays||7)-elapsed);
}
