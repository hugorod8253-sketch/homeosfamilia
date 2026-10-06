import { ImageResponse } from "next/og";
export const size={width:180,height:180};
export const contentType="image/png";
export default function AppleIcon(){
 return new ImageResponse(
  <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",background:"#f7f8f4",borderRadius:38}}>
   <div style={{width:132,height:132,display:"flex",alignItems:"center",justifyContent:"center",background:"#24362d",borderRadius:34,color:"#f7f8f4",fontSize:82,fontWeight:800,fontFamily:"Arial"}}>H</div>
  </div>,
  {...size}
 );
}