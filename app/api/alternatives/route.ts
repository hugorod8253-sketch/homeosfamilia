import { normalizeBarcode } from '../../../lib/barcode-product';

export const runtime = 'nodejs';
const grades: Record<string,number> = {a:0,b:1,c:2,d:3,e:4};
const cache = new Map<string,{until:number;data:unknown}>();
const validCategory = /^en:[a-z0-9-]{3,90}$/;
// A parent category (e.g. spreads) may contain unrelated foods. Require the
// candidate to share a specific product family, not merely an umbrella tag.
const broad = new Set(['en:spreads','en:breakfasts','en:foods','en:snacks','en:desserts','en:sweet-spreads','en:plant-based-foods-and-beverages','en:confectioneries']);

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const code = normalizeBarcode(params.get('code')||'');
  const category = params.get('category')||'';
  const grade = (params.get('grade')||'').toLowerCase();
  const sourceName=(params.get('name')||'').trim().slice(0,110);
  const sourceTags=(params.get('categories')||'').split(',').filter(tag=>validCategory.test(tag));
  if(!code || !validCategory.test(category) || broad.has(category) || !sourceTags.includes(category) || !(grade in grades)) return Response.json({items:[],message:'No se puede comparar este producto con datos suficientes.'},{status:400});
  if(grade==='a') return Response.json({items:[],message:'Este producto ya tiene Nutri-Score A; no existe una letra superior.'});
  const key = category+':'+grade+':'+code;
  const hit=cache.get(key);
  if(hit && hit.until>Date.now()) return Response.json(hit.data);
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),7500);
  try {
    const url=new URL('https://world.openfoodfacts.org/cgi/search.pl');
    url.searchParams.set('search_simple','1');
    url.searchParams.set('action','process');
    url.searchParams.set('json','1');
    url.searchParams.set('tagtype_0','categories');
    url.searchParams.set('tag_contains_0','contains');
    url.searchParams.set('tag_0',category);
    url.searchParams.set('fields','code,product_name,product_name_es,brands,quantity,nutriscore_grade,categories_tags');
    url.searchParams.set('page_size','100');
    url.searchParams.set('sort_by','popularity_key');
    const response=await fetch(url,{signal:controller.signal,headers:{'User-Agent':'HomeOS/2.0 (https://homeosfamilia.vercel.app)','Accept':'application/json'},cache:'no-store'});
    if(!response.ok) throw new Error('upstream');
    const payload=await response.json() as {products?:unknown[]};
    const candidates=(payload.products||[]).filter((p):p is Record<string,unknown>=>Boolean(p)&&typeof p==='object'&&!Array.isArray(p));
    const unique=new Set<string>();
    const items=candidates.flatMap(p=>{
      const barcode=typeof p.code==='string'?normalizeBarcode(p.code):undefined;
      const name=typeof p.product_name_es==='string'&&p.product_name_es.trim()?p.product_name_es.trim():typeof p.product_name==='string'?p.product_name.trim():'';
      const score=typeof p.nutriscore_grade==='string'?p.nutriscore_grade.toLowerCase():'';
      const categories=Array.isArray(p.categories_tags)?p.categories_tags:[];
      if(!barcode||barcode===code||!name||!(score in grades)||grades[score]>=grades[grade]||!categories.includes(category)||unique.has(barcode))return [];
      // Open Food Facts classifications are crowd-sourced; reject obviously
      // incompatible product names rather than claiming verified equivalence.
      const familyTokens=(s:string)=>s.toLocaleLowerCase('es').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').split(/[^a-z0-9]+/).filter(w=>w.length>=5&&!['crema','cremes','spread','pasta','organic','extra','natural','original','producto','ecologico','chocolate','sugar','azucar'].includes(w));
      const specific=familyTokens(sourceName);
      const other=familyTokens(name);
      if(specific.length && !specific.some(token=>other.includes(token))) return [];
      unique.add(barcode);
      return [{barcode,name,brand:typeof p.brands==='string'?p.brands:'',size:typeof p.quantity==='string'?p.quantity:'',grade:score,url:'https://world.openfoodfacts.org/product/'+barcode}];
    }).sort((a,b)=>grades[a.grade]-grades[b.grade]).slice(0,6);
    const data={items,message:items.length?'Posibles alternativas de la misma familia con mejor Nutri-Score. Revisa ingredientes y envase: la equivalencia no está garantizada. Precio y disponibilidad no comprobados.':'No se encontraron alternativas verificables con mejor Nutri-Score en esta categoría.',source:'Open Food Facts'};
    if(cache.size>80)cache.clear();
    cache.set(key,{until:Date.now()+15*60_000,data});
    return Response.json(data);
  } catch {
    return Response.json({items:[],message:'No se pueden consultar alternativas ahora. Inténtalo de nuevo.'},{status:503});
  } finally {clearTimeout(timer)}
}
