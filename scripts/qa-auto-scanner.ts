import assert from "node:assert/strict";
import { lookupBarcode } from "../lib/barcode-product";
const barcode="3560070791460";
const responseFor=(product_type:string):typeof fetch=>async()=>new Response(JSON.stringify({
 product:{code:barcode,product_type,product_name_es:"Producto de ejemplo",ingredients_text:"Componentes declarados",allergens_tags:[],nutriments:{"sugars_100g":3}}
}),{status:200,headers:{"content-type":"application/json"}});
async function main(){
for(const [source,expected] of [["food","food"],["beauty","beauty"],["product","household"],["petfood","household"]] as const){
 const result=await lookupBarcode(barcode,"food",{fetcher:responseFor(source)});
 assert.equal(result.status,"found");
 if(result.status==="found"){
  assert.equal(result.product.kind,expected);
  if(expected!=="food")assert.equal(result.product.nutriScore,undefined);
 }
}
console.log("PASS: one barcode scanner detects food, beauty, household and pet products automatically");

}
void main().catch(error=>{console.error(error);process.exitCode=1});
