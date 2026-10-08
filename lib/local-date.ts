/** Calendar dates use the device timezone, not UTC (which can be yesterday in Spain). */
export function localDateIso(date=new Date()){
 return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}
export function calendarDaysUntil(value:string,now=new Date()){
 const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
 if(!match)return 999;
 return Math.round((Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3]))-Date.UTC(now.getFullYear(),now.getMonth(),now.getDate()))/86400000);
}
