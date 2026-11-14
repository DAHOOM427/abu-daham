import {valid,json} from "../lib/auth.js";
// Check only hand-reviewed sources. Never accept caller-supplied URLs.
const CHANNELS=[
 {
  "id": "v-aljazeera-ar",
  "url": "https://live-hls-apps-aja-fa.getaj.net/AJA/index.m3u8"
 },
 {
  "id": "v-alarabiya-2026",
  "url": "https://live.alarabiya.net/alarabiapublish/alarabiya.smil/playlist.m3u8"
 },
 {
  "id": "v-asharq-news",
  "url": "https://live-news.asharq.com/asharq.m3u8"
 },
 {
  "id": "v-sky-arabia",
  "url": "https://stream.skynewsarabia.com/ott/ott.m3u8"
 },
 {
  "id": "v-bbc-arabic",
  "url": "https://vs-hls-pushb-ww.live.cf.md.bbci.co.uk/x=4/i=urn:bbc:pips:service:bbc_arabic_tv/pc_hd_abr_v2.m3u8"
 },
 {
  "id": "v-cnbc-ar",
  "url": "https://cnbc-live.akamaized.net/cnbc/master.m3u8"
 },
 {
  "id": "v-trt-ar",
  "url": "https://tv-trtarabi.medya.trt.com.tr/master.m3u8"
 },
 {
  "id": "v-spacetoon-ar",
  "url": "https://live-uae-next.spacetoongo.com/ST_MENA_NEXT/hls/r9p2hjipmw2kl.m3u8"
 },
 {
  "id": "dw-arabic-verified",
  "url": "https://dwamdstream103.akamaized.net/hls/live/2015526/dwstream103/master.m3u8"
 },
 {
  "id": "dw-english-verified",
  "url": "https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/master.m3u8"
 }
];
const TTL=12*60*1000;
let cache={at:0,items:null};
async function check(x){
 const started=Date.now();
 try{
  // Send the site's Origin. Server reachability alone does not imply browser playback permission.
  const origin="https://abu-daham.vercel.app";
  const r=await fetch(x.url,{headers:{"Accept":"application/vnd.apple.mpegurl,application/x-mpegURL,text/plain","Origin":origin},signal:AbortSignal.timeout(6500),redirect:"follow"});
  const content=await r.text();
  const cors=String(r.headers.get("access-control-allow-origin")||"").trim();
  const browserCors=cors==="*"||cors===origin?cors:"";
  return {id:x.id,manifestReachable:r.ok&&/^\s*#EXTM3U/.test(content.replace(/^\uFEFF/,"").slice(0,300)),http:r.status,browserCors,latencyMs:Date.now()-started};
 }catch(e){return {id:x.id,manifestReachable:false,http:0,browserCors:"",reason:e.name==="TimeoutError"?"timeout":"network",latencyMs:Date.now()-started}}
}
export default async function handler(req,res){
 if(req.method!=="GET")return json(res,405,{error:"Method not allowed"});
 if(!valid(req))return json(res,401,{error:"يلزم تسجيل الدخول أولاً."});
 if(!cache.items||Date.now()-cache.at>TTL){
  const items=await Promise.all(CHANNELS.map(check));
  cache={at:Date.now(),items};
 }
 return json(res,200,{items:cache.items,checkedAt:new Date(cache.at).toISOString(),notice:"فحص وصول قائمة HLS عبر الخادم فقط، وليس ضمانًا للتشغيل داخل المتصفح أو الترخيص أو خلو البث من إعلانات الناقل."},{"Cache-Control":"private, max-age=30"});
}
