// ==UserScript==
// @name         ChatGPT/Gemini/Claude Complete Optimization
// @namespace    http://tampermonkey.net/
// @version      2.0.0
// @description  Width adjustment, DOM cleanup, auto-continue, and initial load optimization
// @author       Lucy (merged & optimized)
// @license      MIT
// @match        https://gemini.google.com/*
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @match        https://claude.ai/chat/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        none
// @run-at       document-start
// ==/UserScript==
(()=>{'use strict';
const h=window.location.hostname;
const isCGPT=h==='chat.openai.com'||h==='chatgpt.com';
const isGemini=h==='gemini.google.com';
const isClaude=h==='claude.ai';
// Fetch interceptor for initial load limit (ChatGPT only)
// OPTIMIZED: Added safety limits to prevent infinite loops and improved performance
if(isCGPT){
  const INIT_MSG=10;
  const MAX_ITERATIONS=1000; // Safety limit to prevent infinite loops
  const rx=/^https:\/\/chatgpt\.com\/backend-api\/conversation\/[a-f0-9\-]{36}$/i;
  const ogFetch=window.fetch;
  window.fetch=function(input,init){
    const url=typeof input==='string'?input:input.url;
    if(!rx.test(url))return ogFetch.apply(this,arguments);
    return ogFetch.apply(this,arguments).then(async r=>{
      try{
        const d=await r.clone().json();
        const nm=[];
        const seen=new Set(); // Track visited nodes to prevent infinite loops
        let nid=d.current_node,nv=0,iterations=0;

        while(iterations++<MAX_ITERATIONS){
          if(!nid||seen.has(nid))break;
          const m=d.mapping[nid];
          if(!m)break;
          seen.add(nid);

          if(m.id==="client-created-root"){nm.push(m);break;}
          const cids=[...m.children];
          while(cids.length&&iterations<MAX_ITERATIONS){
            iterations++;
            const cid=cids.pop();
            const c=d.mapping[cid];
            if(!c||seen.has(cid))continue;
            seen.add(cid);
            nm.push(c);
            cids.push(...c.children);
          }
          if(nv<INIT_MSG&&d.mapping[m.parent]){
            nm.push(m);
          }else{
            nm.push({...m,parent:"client-created-root"});
            nm.push({id:"client-created-root",message:null,parent:null,children:[m.id]});
            break;
          }
          nid=m.parent;
          nv++;
        }
        if(nm.length===Object.keys(d.mapping).length)return r;
        d.mapping=Object.fromEntries(nm.map(m=>[m.id,m]));
        return new Response(JSON.stringify(d),{status:r.status,statusText:r.statusText,headers:r.headers});
      }catch(e){return r;}
    });
  };
}
// Width adjustment
const runReady=(sel,cb)=>{
  let n=0;
  const t=()=>{
    const e=document.querySelector(sel);
    e?cb(e):++n<34?setTimeout(t,250*1.1**n):0;
  };
  t();
};
// OPTIMIZED: Use direct style assignment instead of setProperty for better performance
const applyW=(gf)=>gf().forEach(e=>{
  e.style.maxWidth='98%';
  e.style.cssText+=';max-width:98%!important';
});
// OPTIMIZED: Debounce width application to reduce excessive calls
const observeW=(gf)=>{
  let timer=null;
  new MutationObserver(ms=>{
    if(ms.some(m=>m.type==='childList')){
      clearTimeout(timer);
      timer=setTimeout(()=>applyW(gf),150);
    }
  }).observe(document.documentElement,{childList:true,subtree:true});
};
if(isCGPT){
  const gf=()=>document.querySelectorAll('.text-base, .text-base > div:first-child');
  runReady('.text-base',()=>{applyW(gf);observeW(gf);});
}else if(isGemini){
  const gf=()=>document.querySelectorAll('.conversation-container');
  runReady('.conversation-container',()=>{applyW(gf);observeW(gf);});
}else if(isClaude){
  const gf=()=>{
    const e=document.querySelector('div[data-test-render-count]');
    if(!e)return[];
    const l1=e.parentElement,l2=l1.parentElement;
    return[l1,l2];
  };
  runReady('div[data-is-streaming]',()=>{applyW(gf);observeW(gf);});
}
// DOM cleanup & auto-continue (ChatGPT only)
// OPTIMIZED: Only cleanup when page is visible to save CPU
if(isCGPT){
  const MAX_MSG=20;
  const cleanup=()=>{
    if(document.visibilityState!=='visible')return;
    const ms=document.querySelectorAll('[data-testid^="conversation-turn"]');
    if(ms.length>MAX_MSG)Array.from(ms).slice(0,ms.length-MAX_MSG).forEach(e=>e.remove());
  };
  const intervals=[{d:10000,i:2000},{d:15000,i:3000},{d:10000,i:5000}];
  const schedInt=(idx)=>{
    if(idx<intervals.length){
      const{d,i}=intervals[idx];
      setTimeout(()=>schedInt(idx+1),d);
      const iv=setInterval(cleanup,i);
      setTimeout(()=>clearInterval(iv),d);
    }else setInterval(cleanup,30000);
  };
  window.addEventListener('load',()=>schedInt(0));
  // Auto-continue logic
  const getTx=()=>document.querySelector('form textarea');
  const getStopBtn=()=>document.querySelector('button[data-testid$="stop-button"]');
  const getSubmit=()=>document.querySelector('button[data-testid$="send-button"]');
  const isGen=()=>{
    if(getStopBtn())return true;
    const s=getSubmit();
    return s?.firstElementChild?.childElementCount===3;
  };
  const getContBtn=()=>Array.from(document.querySelectorAll('button[as="button"]')).find(b=>b.textContent?.includes('Continue'));
  const getRegenBtn=()=>Array.from(document.querySelectorAll('button')).find(b=>/^Regenerate$/i.test(b.textContent?.trim()||''));
  let retries=0,lastRetry=null;
  const init=async()=>{
    await new Promise(r=>window.addEventListener('load',r));
    await new Promise(r=>setTimeout(r,1000));
  };
  const main=async()=>{
    await init();
    let first=true;
    setInterval(async()=>{
      const now=Date.now();
      if(lastRetry&&now-lastRetry>=300000)retries=0;
      while(true){
        const wt=document.hasFocus()?2000:20000;
        if(!first)await new Promise(r=>setTimeout(r,wt));
        if(!first&&isGen())continue;
        const cb=getContBtn();
        if(cb){cb.click();continue;}
        const rb=getRegenBtn();
        if(rb&&!getTx()){
          if(retries<3){
            await new Promise(r=>setTimeout(r,2000));
            rb.click();
            retries++;
            lastRetry=Date.now();
            continue;
          }else break;
        }
        first=false;
        break;
      }
    },1000);
  };
  main();
}
})();
