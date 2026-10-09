"use client";
import { useEffect, useRef, useState } from 'react';
import { normalizeBarcode, type BarcodeProduct, type LookupResult, type ProductKind } from '../lib/barcode-product';
import { allergenLabel } from '../lib/scanned-package';
import type { IScannerControls } from '@zxing/browser';

export default function ProductScanner({close,onAdd}:{close:()=>void;onAdd:(product:BarcodeProduct,target:'shopping'|'inventory',packs:number,location:string,extra:boolean)=>string}) {
  const [kind,setKind] = useState<ProductKind>('food');
  const [code,setCode] = useState('');
  const [result,setResult] = useState<LookupResult|null>(null);
  const [busy,setBusy] = useState(false);
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
        const hints = new Map([[DecodeHintType.POSSIBLE_FORMATS,[BarcodeFormat.EAN_13,BarcodeFormat.EAN_8,BarcodeFormat.UPC_A,BarcodeFormat.UPC_E,BarcodeFormat.ITF]]]);
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
    setResult(null);
    if(!barcode) {setBusy(false);setResult({status:'invalid',message:'Revisa los números del código de barras.'});return}
    const controller=new AbortController();abort.current=controller;
    setBusy(true);setPacks(1);setLocation('');
    try {
      const response=await fetch(`/api/products?code=${barcode}&kind=${kind}`,{signal:controller.signal});
      const data = await response.json() as LookupResult;
      if(id===sequence.current && mounted.current) setResult(data);
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
    try {
      const { BrowserMultiFormatReader }=await import('@zxing/browser');
      const value=await new BrowserMultiFormatReader().decodeFromImageUrl(url);
      const barcode=normalizeBarcode(value.getText());
      if(id!==sequence.current||!mounted.current)return;
      if(!barcode)throw new Error('invalid');
      setCode(barcode);void lookup(barcode);
    } catch {
      if(id===sequence.current&&mounted.current)setCameraError('No se lee el código. Haz una foto más cerca y con buena luz, o escribe los números.');
    } finally {URL.revokeObjectURL(url);if(mounted.current)setReadingPhoto(false)}
  }
  function changeKind(value:ProductKind) {
    sequence.current++;abort.current?.abort();stopCamera();setCamera(false);setBusy(false);
    setKind(value);setResult(null);setFeedback('');setCameraError('');
  }
  const product=result?.status==='found'?result.product:null;
  const nutritionLabels:Record<string,string>={'energy-kcal':'Energía','proteins':'Proteínas','carbohydrates':'Hidratos','sugars':'Azúcares','fat':'Grasas','saturated-fat':'Saturadas','fiber':'Fibra','salt':'Sal'};
  return <div className="modal-backdrop"><section className="modal product-scanner-modal" aria-labelledby="product-scanner-title">
    <div className="modal-head"><div><span className="eyebrow">ESCÁNER DE PRODUCTOS</span><h2 id="product-scanner-title">Conoce lo que compras</h2></div><button aria-label="Cerrar escáner" onClick={close}>×</button></div>
    <div className="scanner-kind" role="group" aria-label="Tipo de producto"><button className={kind==='food'?'active':''} aria-pressed={kind==='food'} onClick={()=>changeKind('food')}>Alimentación</button><button className={kind==='beauty'?'active':''} aria-pressed={kind==='beauty'} onClick={()=>changeKind('beauty')}>Cosmética e higiene</button></div>
    <div className="scanner-input-panel">
      <button className="primary scanner-camera-button" disabled={busy||readingPhoto} onClick={()=>{setCameraError('');setCamera(value=>!value)}}>{camera?'Detener cámara':'Abrir cámara'}</button>
      <button className="secondary scanner-photo-button" disabled={busy||readingPhoto} onClick={()=>photoInput.current?.click()}>{readingPhoto?'Leyendo foto…':'Leer una foto del código'}</button>
      <input ref={photoInput} hidden type="file" accept="image/*" onChange={event=>{void readPhoto(event.target.files?.[0]);event.currentTarget.value=''}}/>
      {camera&&<div className="scanner-camera"><video ref={video} autoPlay muted playsInline aria-label="Vista de cámara para leer el código de barras"/><span>Centra el código de barras</span></div>}
      {cameraError&&<p role="alert">{cameraError}</p>}
      <form onSubmit={event=>{event.preventDefault();void lookup(code)}}><label htmlFor="scanner-code">También puedes escribir el código</label><div className="scanner-code-row"><input id="scanner-code" inputMode="numeric" autoComplete="off" maxLength={30} placeholder="Números bajo las barras" value={code} onChange={event=>setCode(event.target.value)}/><button className="secondary" disabled={busy||readingPhoto||!code.trim()}>{busy?'Consultando…':'Consultar'}</button></div></form>
      <p>La cámara lee en tu dispositivo. Solo se consulta el código; no se envían fotos ni tu inventario.</p>
    </div>
    {busy&&<p role="status">Buscando el producto…</p>}
    {result&&result.status!=='found'&&<p className="scanner-notice" role="status">{result.message}</p>}
    {product&&<article className="scanner-product">
      <div className="scanner-product-heading"><div><h3>{product.name}</h3><p>{[product.brand,product.packageSize].filter(Boolean).join(' · ')||'Presentación sin datos'}</p></div>{product.nutriScore?<div className={`scanner-nutriscore grade-${product.nutriScore}`}><span>Nutri-Score</span><strong>{product.nutriScore.toUpperCase()}</strong></div>:<span className="scanner-unrated">{product.kind==='food'?'Sin Nutri-Score':'Composición'}</span>}</div>
      {product.kind==='food'&&<><p className="scanner-note">Nutri-Score orienta sobre el perfil nutricional; no es una nota de seguridad ni una puntuación de Yuka.</p><h4>Nutrición por {product.nutritionBasis}</h4>{Object.keys(product.nutritionPer100g).length?<dl className="scanner-nutrition">{Object.entries(product.nutritionPer100g).map(([key,value])=><div key={key}><dt>{nutritionLabels[key]||key}</dt><dd>{value.toLocaleString('es-ES',{maximumFractionDigits:2})} {key==='energy-kcal'?'kcal':'g'}</dd></div>)}</dl>:<p>Sin información nutricional disponible.</p>}{product.novaGroup&&<p>Procesamiento: grupo NOVA {product.novaGroup} de 4.</p>}<h4>Alérgenos declarados</h4><p>{product.allergens.length?product.allergens.map(allergenLabel).join(', '):'No hay información suficiente para asegurar su ausencia.'}</p><p className="scanner-note">Comprueba siempre el envase, especialmente si tienes alergias.</p></>}
      <details className="scanner-details"><summary>Ingredientes{product.additives.length?' y aditivos':''}</summary><p>{product.ingredients||'Ingredientes sin datos.'}</p>{product.additives.length>0&&<p>Aditivos identificados: {product.additives.map(tag=>tag.replace(/^en:/,'').toUpperCase()).join(', ')}.</p>}{product.kind==='beauty'&&<p>Esta ficha no evalúa la seguridad ni la eficacia del cosmético. No conocemos la concentración de cada ingrediente.</p>}</details>
      <div className="scanner-add-panel"><label htmlFor="scanner-packs">Envases de esta presentación</label><div className="scanner-packs">{[1,2,3,4].map(n=><button key={n} aria-pressed={packs===n} className={packs===n?'active':''} onClick={()=>setPacks(n)}>{n}</button>)}<input id="scanner-packs" aria-label="Número de envases" type="number" min={1} max={99} value={packs} onChange={event=>setPacks(Math.max(1,Math.min(99,Math.floor(Number(event.target.value)||1))))}/></div><label htmlFor="scanner-location">Para registrar en casa</label><select id="scanner-location" value={location} onChange={event=>setLocation(event.target.value)}><option value="">Ubicación recomendada</option><option>Nevera</option><option>Despensa</option><option>Congelador</option><option>Sin ubicar</option></select>
      <div className="scanner-add-actions"><button className="primary" onClick={()=>setFeedback(onAdd(product,'shopping',packs,location,false))}>Añadir a la compra</button><button className="secondary" onClick={()=>{const message=onAdd(product,'inventory',packs,location,extra);setFeedback(message);if(message.startsWith('Ya está registrado'))setExtra(true);else setExtra(false)}}>{extra?'Registrar envases adicionales':'Registrar en casa'}</button></div><p className="scanner-note">Añadir a la lista no marca una compra. Registrar en casa confirma existencias sin crear un gasto.</p></div>
      {feedback&&<p className="scanner-feedback" role="status">{feedback}</p>}
      <footer className="scanner-source">Datos: <a href={product.source.url} target="_blank" rel="noopener noreferrer">{product.source.name}</a> · <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noopener noreferrer">ODbL</a>. Consulta: {new Date(product.source.fetchedAt).toLocaleDateString('es-ES')}. Puede haber datos incompletos.</footer>
    </article>}
  </section></div>;
}
