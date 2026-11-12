import {valid,json} from "../lib/auth.js";
export default function handler(req,res){
 if(req.method!=="GET") return json(res,405,{error:"Method not allowed"});
 return json(res,200,{authenticated:valid(req),codeRequired:true});
}