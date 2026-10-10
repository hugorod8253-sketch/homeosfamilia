import { nutritionRating, storedProductFacts, type ProductFactsItem } from '../lib/product-facts';

export default function ProductRating({item,onOpen}:{item:ProductFactsItem;onOpen:(item:ProductFactsItem)=>void}) {
  if(!item.barcode) return null;
  const facts=storedProductFacts(item), grade=nutritionRating(facts);
  const label=grade?`Nutri-Score ${grade.toUpperCase()}`:facts?.kind==='beauty'?'Ver composición':facts?.nutriScore?'Actualizar ficha':'Consultar producto';
  return <button type="button" className={`product-rating ${grade?'grade-'+grade:'unrated'}`} aria-label={`${label} · ${facts?.name||'producto'}`} title="Información del producto; no indica existencias ni caducidad" onClick={()=>onOpen(item)}>{label}<span aria-hidden="true"> ›</span></button>;
}
