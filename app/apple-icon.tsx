import { ImageResponse } from "next/og";
export const size={width:180,height:180};
export const contentType="image/png";
export default function AppleIcon(){
 return new ImageResponse(
  <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",background:"#f7f4ed",borderRadius:38}}>
   <div style={{width:146,height:146,display:"flex",position:"relative",alignItems:"center",justifyContent:"center",background:"#f7f4ed",borderRadius:34,border:"2px solid #e5dfd2"}}>
    <div style={{color:"#183729",fontSize:92,fontWeight:800,fontFamily:"Arial",lineHeight:1}}>H</div>
    <div style={{position:"absolute",top:35,left:70,width:16,height:22,borderRadius:10,background:"#d98c5f"}}/>
    <div style={{position:"absolute",top:56,left:76,width:5,height:48,borderRadius:4,background:"#d98c5f"}}/>
   </div>
  </div>,
  {...size}
 );
}