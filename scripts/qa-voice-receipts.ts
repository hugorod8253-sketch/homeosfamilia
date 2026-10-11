import assert from 'node:assert/strict';
import {interpretShoppingRequest,parseShoppingQuantity} from '../lib/shopping-input';
import {parseReceiptText,receiptWarnings} from '../lib/receipt-local';
const examples=[
 ['Oye, apunta dos briks de leche, seis huevos y un kilo de plátanos',[['leche',2,'bricks'],['huevos',6,'uds'],['plátanos',1,'kg']]],
 ['Me falta un litro de leche y dos paquetes de macarrones',[['leche',1,'L'],['macarrones',2,'pack']]],
 ['Tengo que comprar leche, también necesitamos ketchup y tomate frito',[['leche',1,'bricks'],['ketchup',1,'ud'],['tomate frito',1,'ud']]],
 ['Necesito arroz, pollo y tomate frito para hacer arroz con pollo',[['arroz',1,'ud'],['pollo',1,'ud'],['tomate frito',1,'ud']]],
 ['Pon en la compra tomate frito, huevos y leche',[['tomate frito',1,'ud'],['huevos',1,'ud'],['leche',1,'bricks']]],
 ['Apunta por favor dos latas de atún y 3 botes de tomate triturado',[['atún',2,'latas'],['tomate triturado',3,'botes']]],
] as const;
for(const [phrase,expected] of examples){
 const found=interpretShoppingRequest(phrase);assert.equal(found.home.length,0,phrase);
 assert.deepEqual(found.shopping.map(s=>{const i=parseShoppingQuantity(s);return [i.name,i.qty,i.unit]}),expected,phrase);
}
const mixed=interpretShoppingRequest('Voy a comprar leche y huevos, y luego meter en la nevera pasta con tomate');
assert.deepEqual(mixed.shopping,['leche','huevos']);assert.equal(mixed.home[0]?.kind,'prepared');
assert.equal(mixed.home[0]?.name,'pasta con tomate');
const a=parseReceiptText(['MERCADONA','LECHE SEMI 1L 1,05','YOGUR NATURAL 1,75','2 X PLATANO 3,20','TOTAL 6,00','TARJETA 6,00'].join('\n'));
assert.equal(a.items.length,3);assert.equal(a.total,6);assert.equal(a.items.find(x=>x.name==='Platano')?.qty,2);assert.deepEqual(a.warnings,[]);
const b=parseReceiptText(['LIDL','BAGUETTE 0,99 A','2 x LECHE ENTERA 2,50 A','DESCUENTO -0,25','TOTAL A PAGAR 3,24'].join('\n'));
assert.equal(b.total,3.24);assert.equal(b.items.length,2);assert.equal(b.items[1].qty,2);
assert.ok(b.warnings?.some(x=>x.includes('no coincide')));
const c=parseReceiptText(['DIA','2 UD HUEVOS 4,50 B','1,250 KG MANDARINAS 3,00','TOTAL 7,50'].join('\n'));
assert.equal(c.items.length,2);assert.equal(c.items[0].qty,2);assert.equal(c.items[1].qty,1.25);
assert.equal(c.items[1].unit,'kg');assert.equal(c.total,7.5);
const price=parseReceiptText('2 x 1,50 LECHE 3,00\nTOTAL 3,00');
assert.equal(price.items[0].name,'Leche');assert.equal(price.items[0].qty,2);
assert.ok(receiptWarnings([{name:'Leche',qty:1,price:1.5,raw:'LECHE 1,50'}],3,40).length>=2);
assert.deepEqual(parseReceiptText('TOTAL 2,50').items,[]);
console.log('PASS: multi-item speech and mixed Casa intents; ticket formats, quantity, weight, discounts and review warnings');
