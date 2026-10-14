import type {ConsumptionHabit, ConsumptionExtra} from "./consumption-engine";

export type CoffeeFormat = "none"|"beans"|"ground"|"pods"|"instant";
export type DrinkRoutine = {
 coffeeFormat:CoffeeFormat;
 coffeeCupsPerDay:number;
 coffeeGramsPerCup:number;
 coffeeMilkCupsPerDay:number;
 milkMlPerCoffee:number;
 cocoaCupsPerDay:number;
 cocoaGramsPerCup:number;
 cocoaMilkMlPerCup:number;
 milkPackLiters:number|null;
};
export const DEFAULT_DRINK_ROUTINE:DrinkRoutine={
 coffeeFormat:"none", coffeeCupsPerDay:0, coffeeGramsPerCup:8,
 coffeeMilkCupsPerDay:0, milkMlPerCoffee:60,
 cocoaCupsPerDay:0, cocoaGramsPerCup:15, cocoaMilkMlPerCup:200,
 milkPackLiters:null
};
const formats:CoffeeFormat[]=["none","beans","ground","pods","instant"];
const clip=(n:unknown,min:number,max:number,fallback:number)=>Number.isFinite(Number(n))?Math.max(min,Math.min(max,Number(n))):fallback;
const round=(n:number)=>Math.round(n*1000)/1000;
export function normalizeDrinkRoutine(raw:unknown):DrinkRoutine{
 const v=(raw&&typeof raw==="object"?raw:{} ) as Partial<DrinkRoutine>;
 const coffeeFormat=formats.includes(v.coffeeFormat as CoffeeFormat)?v.coffeeFormat as CoffeeFormat:"none";
 const coffeeCupsPerDay=coffeeFormat==="none"?0:clip(v.coffeeCupsPerDay,0,30,0);
 return {
  coffeeFormat,coffeeCupsPerDay,coffeeGramsPerCup:clip(v.coffeeGramsPerCup,1,25,8),
  coffeeMilkCupsPerDay:Math.min(coffeeCupsPerDay,clip(v.coffeeMilkCupsPerDay,0,30,0)),
  milkMlPerCoffee:clip(v.milkMlPerCoffee,0,400,60),
  cocoaCupsPerDay:clip(v.cocoaCupsPerDay,0,30,0),
  cocoaGramsPerCup:clip(v.cocoaGramsPerCup,1,50,15),
  cocoaMilkMlPerCup:clip(v.cocoaMilkMlPerCup,0,500,200),
  milkPackLiters:typeof v.milkPackLiters==='number'&&[.5,1,1.5,2].includes(v.milkPackLiters)?v.milkPackLiters:null
 };
}
export function coffeeProduct(format:CoffeeFormat){
 return format==="beans"?"Café en grano":format==="ground"?"Café molido":format==="pods"?"Cápsulas de café":format==="instant"?"Café soluble":"";
}
export function drinkRoutineHabits(value:DrinkRoutine):ConsumptionHabit[]{
 const r=normalizeDrinkRoutine(value),habits:ConsumptionHabit[]=[];
 if(r.coffeeCupsPerDay>0){
  const pods=r.coffeeFormat==="pods";
  habits.push({id:"routine-coffee",name:coffeeProduct(r.coffeeFormat),qty:round(r.coffeeCupsPerDay*(pods?1:r.coffeeGramsPerCup)),unit:pods?"uds":"g",days:1});
 }
 if(r.cocoaCupsPerDay>0)habits.push({id:"routine-cocoa",name:"Cacao soluble",qty:round(r.cocoaCupsPerDay*r.cocoaGramsPerCup),unit:"g",days:1});
 const liters=(r.coffeeMilkCupsPerDay*r.milkMlPerCoffee+r.cocoaCupsPerDay*r.cocoaMilkMlPerCup)/1000;
 if(liters>0){
  habits.push({id:"routine-milk",name:"Leche",qty:round(liters),unit:"L",days:1});
  // Only convert cartons to litres when the household confirms the carton size.
  if(r.milkPackLiters)habits.push({id:"routine-milk-bricks",name:"Leche",qty:round(liters/r.milkPackLiters),unit:"bricks",days:1});
 }
 return habits;
}
/** Visitors are recorded as a one-off dated quantity, never as a permanent increase of cups/day. */
export function visitExtras(routine:DrinkRoutine,cups:number,withMilk:boolean,date:string,batchId:string):ConsumptionExtra[]{
 const r=normalizeDrinkRoutine(routine),count=Math.floor(clip(cups,0,30,0));
 if(!count||r.coffeeFormat==="none"||!/^\d{4}-\d{2}-\d{2}$/.test(date))return [];
 const pods=r.coffeeFormat==="pods";
 const extras:ConsumptionExtra[]=[{id:batchId+"-coffee",name:coffeeProduct(r.coffeeFormat),qty:round(count*(pods?1:r.coffeeGramsPerCup)),unit:pods?"uds":"g",date}];
 if(withMilk&&r.milkMlPerCoffee>0)extras.push({id:batchId+"-milk",name:"Leche",qty:round(count*r.milkMlPerCoffee/1000),unit:"L",date});
 return extras;
}
