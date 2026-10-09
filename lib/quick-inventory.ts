import {calendarDaysUntil,isCalendarDate,localDateIso} from './local-date';
export type QuickLevel='bastante'|'mitad'|'poco';
export type AutoPrepared={qty:number;servings?:number;stock:string;source?:string;location:string;mealPrepAuto?:boolean;mealPrepAutoStart?:string;mealPrepAutoQty?:number;mealPrepAutoDays?:number;mealPrepAutoApplied?:number;mealPrepAutoDepleted?:boolean};
/** A qualitative observation never invents grams, pieces or a confirmed count. */
export function observeStock<T extends {qty:number;stock:string;lastConfirmedAt?:string}>(item:T,level:QuickLevel,today=localDateIso()):T&{quickLevel:QuickLevel;quickObservedAt:string}{
 return {...item,stock:level==='poco'?'poco':item.qty>0?'hay':'incierto',quickLevel:level,quickObservedAt:today,lastConfirmedAt:undefined} as T&{quickLevel:QuickLevel;quickObservedAt:string};
}
export function startAutoPrepared<T extends AutoPrepared>(item:T,days:number,today=localDateIso()):T&AutoPrepared{
 const qty=Math.max(0,item.servings??item.qty);
 return {...item,mealPrepAuto:true,mealPrepAutoStart:today,mealPrepAutoQty:qty,mealPrepAutoDays:Math.max(1,Math.min(30,Math.round(days))),mealPrepAutoApplied:0,mealPrepAutoDepleted:false};
}
/** Idempotent calendar-based deduction; never logs a meal or changes ingredients. */
export function advanceAutoPrepared<T extends AutoPrepared>(item:T,today=localDateIso()):T{
 if(!item.mealPrepAuto||item.source!=='mealprep'||item.location==='Congelador'||!item.mealPrepAutoStart||!isCalendarDate(item.mealPrepAutoStart)||!isCalendarDate(today)||!item.mealPrepAutoDays||!Number.isFinite(item.mealPrepAutoQty))return item;
 const elapsed=Math.max(0,-calendarDaysUntil(item.mealPrepAutoStart,new Date(today+'T12:00:00')));
 const target=Math.floor(item.mealPrepAutoQty!*Math.min(elapsed,item.mealPrepAutoDays)/item.mealPrepAutoDays);
 const applied=item.mealPrepAutoApplied||0;
 if(target<=applied)return item;
 const qty=Math.max(0,(item.servings??item.qty)-(target-applied));
 return {...item,qty,servings:qty,stock:qty===0?'incierto':item.stock,mealPrepAutoApplied:target,mealPrepAutoDepleted:qty===0};
}
export function remainingAutoDays(item:AutoPrepared,today=localDateIso()){
 const elapsed=item.mealPrepAutoStart&&isCalendarDate(item.mealPrepAutoStart)?Math.max(0,-calendarDaysUntil(item.mealPrepAutoStart,new Date(today+'T12:00:00'))):0;
 return Math.max(1,(item.mealPrepAutoDays||7)-elapsed);
}
