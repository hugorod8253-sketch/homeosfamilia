import { ImageResponse } from "next/og";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";
export default function AppleIcon() {
 return new ImageResponse(
  <div style={{width:180,height:180,display:"flex",alignItems:"center",justifyContent:"center",background:"#f7f4ed"}}>
   <svg viewBox="0 0 512 512" width="180" height="180" xmlns="http://www.w3.org/2000/svg">
    <rect width="512" height="512" rx="118" fill="#f7f4ed"/>
    <rect x="54" y="58" width="404" height="392" rx="118" fill="#f7f4ed" stroke="#e5dfd2" strokeWidth="10"/>
    <path d="M144 142h64v89h96v-89h64v228h-64v-81h-96v81h-64z" fill="#183729"/>
    <ellipse cx="256" cy="170" rx="35" ry="43" fill="#d98c5f"/>
    <rect x="244" y="207" width="24" height="132" rx="12" fill="#d98c5f"/>
   </svg>
  </div>,size
 );
}
