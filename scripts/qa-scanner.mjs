import assert from 'node:assert/strict';
import React from 'react';
import {create, act} from 'react-test-renderer';
import ScannerModule from '../components/product-scanner.tsx';
import {parseBarcodeProduct} from '../lib/barcode-product.ts';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const ProductScanner = ScannerModule.default || ScannerModule;
const food = parseBarcodeProduct({product:{code:'3560070791460',product_name:'Cereal de prueba',nutriscore_grade:'d',categories_tags:['en:breakfast-cereals']}},'3560070791460','food');
const originalFetch = globalThis.fetch;
let finishOldRequest;
let view;
const textOf = node => typeof node === 'string' ? node : node.children.map(textOf).join(' ');
const button = text => view.root.findAllByType('button').find(b=>textOf(b).includes(text));
try {
  globalThis.fetch = url => String(url).startsWith('/api/alternatives')
    ? new Promise(resolve=>{finishOldRequest=resolve})
    : Promise.resolve(Response.json({status:'found',product:food}));
  await act(async()=>{view=create(React.createElement(ProductScanner,{initialProduct:food,close(){},onAdd(){return 'Añadido'}}))});
  await act(async()=>{button('Buscar una alternativa').props.onClick()});
  await act(async()=>{button('Cosmética').props.onClick()});
  await act(async()=>{button('Alimentación').props.onClick()});
  await act(async()=>{view.root.findByType('form').props.onSubmit({preventDefault(){}})});
  await act(async()=>{finishOldRequest(Response.json({items:[],message:'RESULTADO DEL PRODUCTO ANTERIOR'}))});
  assert(!JSON.stringify(view.toJSON()).includes('RESULTADO DEL PRODUCTO ANTERIOR'),'An old alternatives response must not appear after changing categories and looking up another product');
  assert.equal(button('Buscar una alternativa').props.disabled,false,'A new product must allow a new comparison');
  console.log('PASS: stale alternatives cannot leak across category/product changes');
} finally {
  if(view)await act(async()=>view.unmount());
  globalThis.fetch=originalFetch;
}
