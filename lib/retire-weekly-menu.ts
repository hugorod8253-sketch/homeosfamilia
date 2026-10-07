type Source={type:string;qty:number;unit:string;planId?:string};
type LegacyState={weeklyMenu:unknown;retiredWeeklyMenu?:unknown;shopping:{sources?:Source[];qty:number;unit:string}[];inventory:{planReservations?:Source[]}[]};
export function retireWeeklyMenu<T extends LegacyState>(state:T,updateSources:(item:T["shopping"][number],sources:Source[])=>T["shopping"][number]|null):T{
 if(!state.weeklyMenu&&!state.shopping.some(i=>i.sources?.some(s=>s.type==="weekly"))&&!state.inventory.some(i=>i.planReservations?.some(s=>s.type==="weekly")))return state;
 const shopping=state.shopping.flatMap(item=>{
  if(!item.sources?.some(s=>s.type==="weekly"))return [item];
  const updated=updateSources(item,item.sources.filter(s=>s.type!=="weekly"));
  return updated?[updated]:[];
 });
 const inventory=state.inventory.map(item=>item.planReservations?.some(s=>s.type==="weekly")?{...item,planReservations:item.planReservations.filter(s=>s.type!=="weekly")}:item);
 return {...state,retiredWeeklyMenu:state.retiredWeeklyMenu||state.weeklyMenu||undefined,weeklyMenu:null,shopping,inventory};
}
