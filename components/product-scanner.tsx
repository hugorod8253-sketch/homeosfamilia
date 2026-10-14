"use client";
import { useEffect, useRef, useState } from 'react';
import { normalizeBarcode, type BarcodeProduct, type LookupResult, type ProductKind } from '../lib/barcode-product';
import { nutritionRating } from "../lib/product-facts";
import { allergenLabel } from '../lib/scanned-package';
import type { IScannerControls } from '@zxing/browser';

export default function ProductScanner({close,onAdd,initialProduct,initialCode,onFacts}:{initialProduct?:BarcodeProduct;initialCode?:string;onFacts?:(product:BarcodeProduct)=>void;close:()=>void;onAdd:(product:BarcodeProduct,target:'shopping'|'inventory',packs:number,location:string,extra:boolean)=>string}) {
  const [kind,setKind] = useState<ProductKind>(initialProduct?.kind||'food');
  const [code,setCode] = useState(initialCode||initialProduct?.barcode||'');
  const [result,setResult] = useState<LookupResult|null>(initialProduct?{status:'found',product:initialProduct}:null);
  const [busy,setBusy] = useState(false);
  const [alternativeBusy,setAlternativeBusy] = useState(false);
  const [alternatives,setAlternatives] = useState<{items:{barcode:string;name:string;brand:string;size:string;grade:string;url:string}[];message:string}|null>(null);
  const [camera,setCamera] = useState(false);
  const [cameraError,setCameraError] = useState('');
  const [readingPhoto,setReadingPhoto] = useState(false);
  const [feedback,setFeedback] = useState('');
  const [packs,setPacks] = useState(1);
  const [location,setLocation] = useState('');
  const [extra,setExtra] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const controls = useRef<IScannerControls|null>(null);
  const sequence = useRef(0);
  const alternativesSequence = useRef(0);
  const abort = useRef<AbortController|null>(null);
  const lookupRef = useRef<(code:string)=>void>(()=>{});
  const mounted = useRef(true);

  function stopCamera() {
    controls.current?.stop(); controls.current = null;
    const stream = video.current?.srcObject;
    if (typeof MediaStream !== 'undefined' && stream instanceof MediaStream) stream.getTracks().forEach(track=>track.stop());
    if(video.current) video.current.srcObject = null;
  }
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;sequence.current++;abort.current?.abort();stopCamera()}},[]);
  useEffect(()=>{
    if(!camera) return;
    let cancelled = false, accepted = false;
    async function start() {
      try {
        if(!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        const { BarcodeFormat, DecodeHintType } = await import('@zxing/library');
        if(cancelled || !video.current) return;
        const hints = new Map([[DecodeHintType.POSSIBLE_FORMATS,[BarcodeFormat.EAN_13,BarcodeFormat.EAN_8,BarcodeFormat.UPC_A,BarcodeFormat.ITF]]]);
        const reader = new BrowserMultiFormatReader(hints,{delayBetweenScanAttempts:300});
        const scanner = await reader.decodeFromConstraints({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280}}},video.current,(value,_error,handle)=>{
          if(cancelled || accepted || !value) return;
          const barcode = normalizeBarcode(value.getText());
          if(!barcode) return;
          accepted = true; handle.stop();
          if(mounted.current) {setCamera(false);setCode(barcode);lookupRef.current(barcode)}
        });
        if(cancelled || accepted) scanner.stop(); else controls.current = scanner;
      } catch(error) {
        if(cancelled || !mounted.current) return;
        const name = error instanceof Error ? error.name : '';
        setCameraError(name === 'NotAllowedError' ? 'Cámara sin permiso. Puedes permitirla en el navegador o escribir el código.' : name === 'NotFoundError' ? 'No se encuentra una cámara. Escribe el código de barras.' : 'No se pudo abrir la cámara. Prueba de nuevo o escribe el código.');
        setCamera(false);
      }
    }
    void start();
    return()=>{cancelled=true;stopCamera()};
  },[camera]);

  async function lookup(value:string) {
    const barcode=normalizeBarcode(value);
    const id=++sequence.current;
    abort.current?.abort(); stopCamera(); setCamera(false); setFeedback(''); setExtra(false);
    setResult(null);setAlternatives(null);alternativesSequence.current++;setAlternativeBusy(false);
    if(!barcode) {setBusy(false);setResult({status:'invalid',message:'Revisa los números del código de barras.'});return}
    const controller=new AbortController();abort.current=controller;
    setBusy(true);setPacks(1);setLocation('');
    try {
      const response=await fetch(`/api/products?code=${barcode}&kind=${kind}`,{signal:controller.signal});
      const data = await response.json() as LookupResult;
      if(id===sequence.current && mounted.current) {setResult(data);if(data.status==='found')onFacts?.(data.product)}
    } catch {
      if(id===sequence.current && mounted.current) setResult({status:'unavailable',message:'No se puede consultar ahora. Puedes seguir usando la lista y Casa.'});
    } finally {if(id===sequence.current && mounted.current)setBusy(false)}
  }
  lookupRef.current=(value)=>{void lookup(value)};
  async function readPhoto(file?:File) {
    if(!file)return;
    if(!file.type.startsWith('image/')||file.size>15*1024*1024){setCameraError('Elige una foto de menos de 15 MB.');return}
    stopCamera();setCamera(false);setCameraError('');setReadingPhoto(true);
    const id=++sequence.current, url=URL.createObjectURL(file);
    abort.current?.abort();setBusy(false);setResult(null);setFeedback('');
    alternativesSequence.current++;setAlternativeBusy(false);setAlternatives(null);
    try {
      const { BrowserMultiFormatReader }=await import('@zxing/browser');
      const value=await new BrowserMultiFormatReader().decodeFromImageUrl(url);
      const barcode=normalizeBarcode(value.getText());
      if(id!==sequence.current||!mounted.current)return;
      if(!barcode)throw new Error('invalid');
      setReadingPhoto(false);setCode(barcode);void lookup(barcode);
    } catch {
      if(id===sequence.current&&mounted.current)setCameraError('No se lee el código. Haz una foto más cerca y con buena luz, o escribe los números.');
    } finally {URL.revokeObjectURL(url);if(id===sequence.current&&mounted.current)setReadingPhoto(false)}
  }
  function changeKind(value:ProductKind) {
    sequence.current++;abort.current?.abort();stopCamera();setCamera(false);setBusy(false);setReadingPhoto(false);setExtra(false);
    alternativesSequence.current++;setAlternativeBusy(false);
    setKind(value);setAlternatives(null);setResult(null);setFeedback('');setCameraError('');
  }
  async function findAlternatives(product:BarcodeProduct) {
    const broad=new Set(['en:spreads','en:breakfasts','en:foods','en:snacks','en:desserts','en:sweet-spreads','en:plant-based-foods-and-beverages','en:confectioneries']);
    const category=product.categoryTags?.filter(tag=>!broad.has(tag)).at(-1);
    const grade=nutritionRating(product);
    if(!category||!grade)return;
    const id=++alternativesSequence.current;
    const current=()=>mounted.current&&id===alternativesSequence.current;
    setAlternativeBusy(true);setAlternatives(null);
    try {
      const response=await fetch('/api/alternatives?'+new URLSearchParams({code:product.barcode,category,grade,name:product.name,categories:(product.categoryTags||[]).join(',')}));
      const data=await response.json();
      if(!current())return;
      if(response.ok && data && Array.isArray(data.items))setAlternatives(data);
      else setAlternatives({items:[],message:'No se pueden consultar alternativas ahora.'});
    } catch {if(current())setAlternatives({items:[],message:'Sin conexión para buscar alternativas.'});}
    finally {if(current())setAlternativeBusy(false);}
  }
  const product=result?.status==='found'?result.product:null;
  const grade=nutritionRating(product||undefined);
  const n=product?.nutritionPer100g||{};
  const sugar=n['sugars'], sat=n['saturated-fat'], salt=n['salt'], fiber=n['fiber'], protein=n['proteins'];
  const nutritionKnown=product?.kind==='food' && [sugar,sat,salt,protein,fiber].filter(v=>typeof v==='number').length>=3;
  const cereal=/(cereal|corn flakes|choco|muesli|granola|galleta|cookie|bollería)/i.test((product?.name||'')+' '+(product?.categoryText||''));
  const sweetDrink=/(refresco|cola|soda|bebida azucarada|energy drink)/i.test((product?.name||'')+' '+(product?.categoryText||''));
  const wholeFood=/(fruta fresca|verdura fresca|legumbre|lenteja|garbanzo)/i.test(product?.categoryText||'');
  const nutritionScore=nutritionKnown?Math.max(0,Math.min(100,Math.round(72
    -(sugar!==undefined?Math.max(0,sugar-(wholeFood?18:5))*(sweetDrink?2.8:cereal?2.3:1.25):0)
    -(sat!==undefined?Math.max(0,sat-2)*3:0)
    -(salt!==undefined?Math.max(0,salt-.3)*10:0)
    +(fiber!==undefined?Math.min(fiber,8)*2:0)
    +(protein!==undefined?Math.min(protein,18)*.5:0)))):null;
  const scoreTone=nutritionScore===null?'unknown':nutritionScore<40?'bad':nutritionScore<65?'medium':'good';
  const signals=[
    {label:'Azúcares',value:sugar,unit:'g',tone:sugar===undefined?'unknown':sugar>15?'bad':sugar>5?'medium':'good',note:'Azúcares totales; no equivalen necesariamente a azúcares añadidos'},
    {label:'Grasas saturadas',value:sat,unit:'g',tone:sat===undefined?'unknown':sat>5?'bad':sat>1.5?'medium':'good',note:'Importa más el tipo de grasa que la grasa total'},
    {label:'Sal',value:salt,unit:'g',tone:salt===undefined?'unknown':salt>1.5?'bad':salt>.3?'medium':'good',note:'Por 100 g o 100 ml'},
    {label:'Proteínas',value:protein,unit:'g',tone:protein===undefined?'unknown':protein>=12?'good':protein>=5?'medium':'neutral',note:'Una cantidad baja no significa que el alimento sea malo'},
    {label:'Fibra',value:fiber,unit:'g',tone:fiber===undefined?'unknown':fiber>=6?'good':fiber>=3?'medium':'neutral',note:'La fibra es especialmente útil en cereales y legumbres'},
  ];
  const nutritionLabels:Record<string,string>={'energy-kcal':'Energía','proteins':'Proteínas','carbohydrates':'Hidratos','sugars':'Azúcares','fat':'Grasas','saturated-fat':'Saturadas','fiber':'Fibra','salt':'Sal'};
  return <div className="modal-backdrop"><section className="modal product-scanner-modal" role="dialog" aria-modal="true" aria-labelledby="product-scanner-title">
    <div className="modal-head"><div><span className="eyebrow">ESCÁNER DE PRODUCTOS</span><h2 id="product-scanner-title">Escanea tu producto</h2></div><button aria-label="Cerrar escáner" onClick={close}>×</button></div>
    <div className="scanner-kind" role="group" aria-label="Tipo de producto">
      {([
        ['food','Alimentación','Comida y bebida','🥦'],
        ['beauty','Cosmética','Higiene y cuidado','🧴'],
        ['household','Hogar','Limpieza y otros','🧽'],
      ] as const).map(([value,label,description,icon])=><button key={value} type="button" className={`scanner-category scanner-category-${value}${kind===value?' active':''}`} aria-pressed={kind===value} onClick={()=>changeKind(value)}>
        <span className="scanner-category-check" aria-hidden="true">{kind===value?'✓':''}</span>
        <span className="scanner-category-icon" aria-hidden="true">{icon}</span>
        <strong>{label}</strong><small>{description}</small>
      </button>)}
    </div>
    <div className="scanner-input-panel">
      <button className="primary scanner-camera-button" disabled={busy||readingPhoto} onClick={()=>{setCameraError('');setCamera(value=>!value)}}>{camera?'Detener cámara':'Escanear código de barras'}</button>
      <button className="secondary scanner-photo-button" disabled={busy||readingPhoto} onClick={()=>photoInput.current?.click()}>{readingPhoto?'Leyendo foto…':'Leer una foto del código'}</button>
      <input ref={photoInput} hidden type="file" accept="image/*" onChange={event=>{void readPhoto(event.target.files?.[0]);event.currentTarget.value=''}}/>
      {camera&&<div className="scanner-camera"><video ref={video} autoPlay muted playsInline aria-label="Vista de cámara para leer el código de barras"/><span>Centra el código de barras</span></div>}
      {cameraError&&<p role="alert">{cameraError}</p>}
      <form onSubmit={event=>{event.preventDefault();void lookup(code)}}><label htmlFor="scanner-code">También puedes escribir el código</label><div className="scanner-code-row"><input id="scanner-code" inputMode="numeric" autoComplete="off" maxLength={30} placeholder="Números bajo las barras" value={code} onChange={event=>setCode(event.target.value)}/><button className="secondary" disabled={busy||readingPhoto||!code.trim()}>{busy?'Consultando…':initialCode&&product?'Actualizar ficha':'Consultar'}</button></div></form>
      <p>La cámara lee en tu dispositivo. Solo se consulta el código; no se envían fotos ni tu inventario.</p>
    </div>
    {busy&&<p role="status">Buscando el producto…</p>}
    {result&&result.status!=='found'&&<p className="scanner-notice" role="status">{result.message}</p>}
    {product&&<article className="scanner-product">
      <div className="scanner-product-heading"><div><h3>{product.name}</h3><p>{[product.brand,product.packageSize].filter(Boolean).join(' · ')||'Presentación sin datos'}</p></div>{grade?<div className={`scanner-nutriscore grade-${grade}`}><span>Nutri-Score</span><strong>{grade.toUpperCase()}</strong></div>:<span className="scanner-unrated">{product.kind==='food'?(product.nutriScore?'Actualizar ficha':'Sin Nutri-Score'):'Composición'}</span>}</div>
      {product.kind==='food'&&<><section className="homeos-health-evaluation" aria-label="Valoración nutricional independiente"><div className="homeos-health-header"><div><strong>Valoración HomeOS</strong><small>Estimación orientativa · no es Nutri-Score ni diagnóstico médico</small></div><strong className={`homeos-health-score ${scoreTone}`}>{nutritionScore===null?'Sin datos':`${nutritionScore}/100`}</strong></div><div className="homeos-health-signals">{signals.map(s=><div className={`homeos-health-signal ${s.tone}`} key={s.label}><span>{s.label}</span><strong>{s.value===undefined?'Sin datos':`${s.value.toLocaleString('es-ES')} ${s.unit}`}</strong><small>{s.note}</small></div>)}</div><p className="scanner-note">La nota se calcula con los datos disponibles, teniendo en cuenta azúcares, grasas saturadas, sal, fibra y proteínas. La receta, el tipo de alimento y la ración también importan. Si faltan datos, no damos una nota.</p></section><p className="scanner-note">Nutri-Score orienta sobre el perfil nutricional; no es una nota de seguridad ni una puntuación de Yuka.</p><h4>Nutrición por {product.nutritionBasis}</h4>{Object.keys(product.nutritionPer100g).length?<dl className="scanner-nutrition">{Object.entries(product.nutritionPer100g).map(([key,value])=><div key={key}><dt>{nutritionLabels[key]||key}</dt><dd>{value.toLocaleString('es-ES',{maximumFractionDigits:2})} {key==='energy-kcal'?'kcal':'g'}</dd></div>)}</dl>:<p>Sin información nutricional disponible.</p>}{product.novaGroup&&<p>Procesamiento: grupo NOVA {product.novaGroup} de 4.</p>}<h4>Alérgenos declarados</h4><p>{product.allergens.length?product.allergens.map(allergenLabel).join(', '):'No hay información suficiente para asegurar su ausencia.'}</p><p className="scanner-note">Comprueba siempre el envase, especialmente si tienes alergias.</p></>}
      <details className="scanner-details"><summary>Ingredientes{product.additives.length?' y aditivos':''}</summary><p>{product.ingredients||'Ingredientes sin datos.'}</p>{product.additives.length>0&&<p>Aditivos declarados: {product.additives.map(tag=>tag.replace(/^en:/,'').toUpperCase()).join(', ')}.</p>}{product.kind==='food'&&product.additives.length>0&&<p className="scanner-note">Contener aditivos no significa que el producto sea peligroso. Su seguridad depende de las condiciones de uso y de la exposición. <a href="https://www.efsa.europa.eu/es/safe2eat/food-additives" target="_blank" rel="noopener noreferrer">Información de EFSA</a>.</p>}{product.kind==='beauty'&&<p>Esta ficha no evalúa la seguridad ni la eficacia del cosmético. No conocemos la concentración de cada ingrediente.</p>}</details>
      {product.kind==='food'&&<section aria-label="Comparar alternativas" style={{margin:'18px 0',padding:'16px',borderRadius:16,background:'var(--surface-secondary, #f1f5f9)'}}>
        <h4 style={{margin:'0 0 8px'}}>¿Hay una opción con mejor perfil nutricional?</h4>
        <p className="scanner-note">Comparamos el Nutri-Score publicado entre productos de la misma categoría; no inventamos notas de 0 a 100.</p>
        {grade && product.categoryTags?.some(tag=>!new Set(['en:spreads','en:breakfasts','en:foods','en:snacks','en:desserts','en:sweet-spreads','en:plant-based-foods-and-beverages','en:confectioneries']).has(tag)) ? <button type="button" className="primary" style={{width:'100%',padding:'14px',fontWeight:700}} disabled={alternativeBusy} onClick={()=>void findAlternatives(product)}>{alternativeBusy?'Buscando alternativas…':'Buscar una alternativa mejor →'}</button>:<p className="scanner-note">Faltan la categoría o el Nutri-Score: no es posible comparar de forma fiable.</p>}
        {alternatives&&<div role="status" style={{marginTop:12}}><p className="scanner-note">{alternatives.message}</p>{alternatives.items.map(item=><div key={item.barcode} style={{padding:'12px 0',borderBottom:'1px solid #cbd5e1'}}><strong>{item.name}</strong><p style={{margin:'4px 0'}}>{[item.brand,item.size].filter(Boolean).join(' · ')} · Nutri-Score {item.grade.toUpperCase()}</p><a href={item.url} target="_blank" rel="noopener noreferrer">Ver ficha y datos de origen ↗</a></div>)}</div>}
      </section>}
      {product.kind==='beauty'&&<p className="scanner-note">La composición cosmética no permite establecer un ranking fiable sin evaluar fórmula, uso y exposición. No mostramos falsas alternativas «más seguras».</p>}
      <div className="scanner-add-panel"><label htmlFor="scanner-packs">Envases de esta presentación</label><div className="scanner-packs">{[1,2,3,4].map(n=><button key={n} aria-pressed={packs===n} className={packs===n?'active':''} onClick={()=>setPacks(n)}>{n}</button>)}<input id="scanner-packs" aria-label="Número de envases" type="number" min={1} max={99} value={packs} onChange={event=>setPacks(Math.max(1,Math.min(99,Math.floor(Number(event.target.value)||1))))}/></div><label htmlFor="scanner-location">Para registrar en casa</label><select id="scanner-location" value={location} onChange={event=>setLocation(event.target.value)}><option value="">Ubicación recomendada</option><option>Nevera</option><option>Despensa</option><option>Congelador</option><option>Sin ubicar</option></select>
      <div className="scanner-add-actions"><button className="primary" onClick={()=>setFeedback(onAdd(product,'shopping',packs,location,false))}>Añadir a la compra</button><button className="secondary" onClick={()=>{const message=onAdd(product,'inventory',packs,location,extra);setFeedback(message);if(message.startsWith('Ya está registrado'))setExtra(true);else setExtra(false)}}>{extra?'Registrar envases adicionales':'Registrar en casa'}</button></div><p className="scanner-note">Añadir a la lista no marca una compra. Registrar en casa confirma existencias sin crear un gasto.</p></div>
      {feedback&&<p className="scanner-feedback" role="status">{feedback}</p>}
      <footer className="scanner-source">Datos: <a href={product.source.url} target="_blank" rel="noopener noreferrer">{product.source.name}</a> · <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noopener noreferrer">ODbL</a>. Consulta: {new Date(product.source.fetchedAt).toLocaleDateString('es-ES')}. Puede haber datos incompletos.</footer>
    </article>}
  </section></div>;
}
