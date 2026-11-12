import {json,cookieName} from "../lib/auth.js";
export default function handler(req,res){
 if(req.method!=="POST") return json(res,405,{error:"Method not allowed"});
 return json(res,200,{ok:true},{"Set-Cookie":cookieName+"=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0"});
}