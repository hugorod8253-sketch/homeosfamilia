import { normalizeBarcode } from '../../../lib/barcode-product';

export const runtime = 'nodejs';
const grades: Record<string,number> = {a:0,b:1,c:2,d:3,e:4};
const cache = new Map<string,{until:number;data:unknown}>();
const validCategory = /^en:[a-z0-9-]{3,90}$/;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const code = normalizeBarcode(params.get('code')||'');
  const category = params.get('category')||'';
  const grade = (params.get('grade')||'').toLowerCase();
  if(!code || !validCategory.test(category) || !(grade in grades)) return Response.json({items:[],message:'No se puede comparar este producto con datos suficientes.'},{status:400});
  if(grade==='a') return Response.json({items:[],message:'Este producto ya tiene Nutri-Score A; no existe una letra superior.'});
  const key = category+':'+grade+':'+code;
  const hit=cache.get(key);
  if(hit && hit.until>Date.now()) return Response.json(hit.data);
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),7500);
  try {
    const better=Object.keys(grades).filter(g=>grades[g]<grades[grade]).join(',');
    const url=new URL('https://world.openfoodfacts.org/api/v2/search');
    url.searchParams.set('categories_tags_en',category.slice(3));
    url.searchParams.set('nutrition_grades_tags',better);
    url.searchParams.set('fields','code,product_name,product_name_es,brands,quantity,nutriscore_grade,categories_tags');
    url.searchParams.set('page_size','45');
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
      unique.add(barcode);
      return [{barcode,name,brand:typeof p.brands==='string'?p.brands:'',size:typeof p.quantity==='string'?p.quantity:'',grade:score,url:'https://world.openfoodfacts.org/product/'+barcode}];
    }).sort((a,b)=>grades[a.grade]-grades[b.grade]).slice(0,6);
    const data={items,message:items.length?'Alternativas con mejor Nutri-Score dentro de la misma categoría. No se ha comprobado el precio ni la disponibilidad.':'No se encontraron alternativas verificables con mejor Nutri-Score en esta categoría.',source:'Open Food Facts'};
    if(cache.size>80)cache.clear();
    cache.set(key,{until:Date.now()+15*60_000,data});
    return Response.json(data);
  } catch {
    return Response.json({items:[],message:'No se pueden consultar alternativas ahora. Inténtalo de nuevo.'},{status:503});
  } finally {clearTimeout(timer)}
}
