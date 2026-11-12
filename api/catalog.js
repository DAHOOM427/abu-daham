import {valid,json} from "../lib/auth.js";
async function tmdb(url){const r=await fetch(url,{headers:{Authorization:"Bearer "+process.env.TMDB_TOKEN,Accept:"application/json"},signal:AbortSignal.timeout(12000)});if(!r.ok)throw new Error("TMDB returned "+r.status);return r.json()}
export default async function handler(req,res){
 if(req.method!=="GET")return json(res,405,{error:"Method not allowed"});
 if(!valid(req))return json(res,401,{error:"يلزم تسجيل الدخول أولاً."});
 if(!process.env.TMDB_TOKEN)return json(res,503,{items:[],providers:[{provider:"TMDB",error:"يلزم إضافة TMDB_TOKEN في إعدادات Vercel لتفعيل قاعدة بيانات الأفلام والمسلسلات."}]});
 const q=String(req.query?.q||"").slice(0,120),type=String(req.query?.type||"all"),page=Math.max(1,Math.min(500,Number(req.query?.page||1)));
 const kinds=type==="movie"?["movie"]:type==="tv"?["tv"]:type==="anime"?["anime"]:["movie","tv"];
 try{
  const results=await Promise.all(kinds.map(async k=>{
   const path=q?"/search/"+(k==="anime"?"tv":k):"/trending/"+(k==="anime"?"tv":k)+"/week";
   const params=new URLSearchParams({language:"ar-SA",page:String(page)});
   if(q)params.set("query",q);
   const d=await tmdb("https://api.themoviedb.org/3"+path+"?"+params);
   return (d.results||[]).map(x=>({id:String(x.id),type:k==="anime"?"anime":k,title:x.title||x.name||x.original_name||"بدون عنوان",year:String((x.release_date||x.first_air_date||"").slice(0,4)),overview:x.overview||"",poster:x.poster_path?"https://image.tmdb.org/t/p/w500"+x.poster_path:"",rating:Number(x.vote_average||0)}));
  }));
  const items=results.flat().sort((a,b)=>b.rating-a.rating).slice(0,60);
  return json(res,200,{items,page,providers:[{provider:"TMDB",count:items.length}]});
 }catch(e){return json(res,502,{items:[],providers:[{provider:"TMDB",error:"تعذر جلب البيانات حالياً."}]})}
}