/* オフライン用。データを更新したら VERSION を上げる */
const VERSION='shakai-v1-20261107';
const FILES=['./','./index.html','./app.css','./app.js','./manifest.webmanifest','./icon.svg','./icon-180.png','./icon-512.png','./data/knowledge.json','./data/questions.json'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(VERSION).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const isData=e.request.url.includes('/data/');
  if(isData){ // データは通信できればいつも最新、できなければ保存分
    e.respondWith(fetch(e.request).then(r=>{const cp=r.clone();caches.open(VERSION).then(c=>c.put(e.request,cp));return r}).catch(()=>caches.match(e.request)));
  }else{
    e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
  }
});
