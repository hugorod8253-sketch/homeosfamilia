import {classifyProduct} from './product-engine';
import {calendarDaysUntil,isCalendarDate,localDateIso} from './local-date';
export type FreshnessItem={qty:number;stock:string;location:string;expires?:string;dateType?:string;estimatedExpires?:string;qualityReviewAt?:string;name?:string;category?:string;purchasedAt?:string;purchaseDateUnknown?:boolean};
export type FreshnessNotice={kind:'expired'|'date'|'slow'|'estimate'|'quality';text:string;priority:number};
/** A reservation does not postpone a labelled date. Estimates never certify food safety. */
export function freshnessNotice(item:FreshnessItem,daysLeft:number|null=null,today=localDateIso()):FreshnessNotice|null{
 if(item.qty<=0||item.stock==='falta')return null;
 const days=(date:string)=>calendarDaysUntil(date,new Date(today+'T12:00:00'));
 if(item.location==='Congelador')return item.qualityReviewAt&&isCalendarDate(item.qualityReviewAt)&&days(item.qualityReviewAt)<=0?{kind:'quality',text:'Revisión de calidad del congelado pendiente',priority:3}:null;
 if(item.expires&&isCalendarDate(item.expires)){
  const left=days(item.expires),expiry=item.dateType==='caducidad';
  if(left<0)return {kind:expiry?'expired':'quality',text:expiry?'Fecha de caducidad superada · no consumir':'Consumo preferente superado · revisa conservación y envase',priority:expiry?0:2};
  if(left<=3)return {kind:'date',text:(expiry?'Caduca':'Consumo preferente')+(left===0?' hoy':left===1?' mañana':' en '+left+' días'),priority:1};
  if(expiry&&daysLeft!==null&&Number.isFinite(daysLeft)&&daysLeft>left)return {kind:'slow',text:'Caduca en '+left+' días; al ritmo estimado podría sobrar',priority:2};
  return null;
 }
 if(item.estimatedExpires&&isCalendarDate(item.estimatedExpires)&&days(item.estimatedExpires)<=3)return {kind:'estimate',text:'Fecha orientativa próxima · comprueba la etiqueta si aún queda',priority:3};
 if(item.name&&item.purchasedAt&&!item.purchaseDateUnknown&&isCalendarDate(item.purchasedAt)&&days(item.purchasedAt)<=-2&&classifyProduct(item.name,item.category).rotation==='alta')return {kind:'estimate',text:'Fresco sin fecha registrada · prioriza su uso y respeta la etiqueta',priority:3};
 return null;
}
/** Coverage belongs to one product and its unit, never to mixed kg/packs or whole food groups. */
export function stockCoverage(daysLeft:number|null,source:string,horizon=7){
 if(source==='unknown'||daysLeft===null||!Number.isFinite(daysLeft))return {tone:'learn',label:'Ritmo por conocer'};
 if(daysLeft<=horizon*.5)return {tone:'low',label:'Puede escasear pronto'};
 if(daysLeft>horizon*2)return {tone:'plenty',label:'Hay margen para varias compras'};
 return {tone:'steady',label:'Ritmo orientativo estable'};
}
