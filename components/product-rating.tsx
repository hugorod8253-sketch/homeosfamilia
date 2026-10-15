import { storedProductFacts, type ProductFactsItem } from '../lib/product-facts';
import { assessFood } from '../lib/food-assessment';
export default function ProductRating({item,onOpen}:{item:ProductFactsItem;onOpen:(item:ProductFactsItem)=>void}) {
 if(!item.barcode)return null;
 const facts=storedProductFacts(item), assessment=facts?assessFood(facts):null;
 const label=facts?.kind==='food'?(assessment?.status==='estimated'?'Ver análisis alimentario':'Completar datos alimentarios'):facts?.kind==='beauty'?'Ver composición':'Consultar producto';
 return <button type="button" className="product-rating unrated" aria-label={label} title="Análisis orientativo; no indica existencias ni caducidad" onClick={()=>onOpen(item)}>{label}<span aria-hidden="true"> ›</span></button>;
}
