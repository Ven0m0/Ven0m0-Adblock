// ==UserScript==
// @name         Claude tweaks
// @description  Claude tweaks
// @namespace    Ven0m0
// @author       Ven0m0
// @version      0.0.2
// @match        https://claude.ai/*
// @grant        none
// @license      GPLv3
// @run-at      document-start
// ==/UserScript==
(()=>{'use strict';
let pendingFork=null,includeFiles=true,isProc=false,useSummary=false,origSettings=null;
const ogFetch=window.fetch;
// UI creation
const createBtn=()=>{
  const b=document.createElement('button');
  b.className='branch-button flex flex-row items-center gap-1 rounded-md p-1 py-0.5 text-xs transition-opacity delay-100 hover:bg-bg-200 group/button';
  b.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="1.35em" height="1.35em" fill="currentColor" viewBox="0 0 22 22"><path d="M7 5C7 3.89543 7.89543 3 9 3C10.1046 3 11 3.89543 11 5C11 5.74028 10.5978 6.38663 10 6.73244V14.0396H11.7915C12.8961 14.0396 13.7915 13.1441 13.7915 12.0396V10.7838C13.1823 10.4411 12.7708 9.78837 12.7708 9.03955C12.7708 7.93498 13.6662 7.03955 14.7708 7.03955C15.8753 7.03955 16.7708 7.93498 16.7708 9.03955C16.7708 9.77123 16.3778 10.4111 15.7915 10.7598V12.0396C15.7915 14.2487 14.0006 16.0396 11.7915 16.0396H10V17.2676C10.5978 17.6134 11 18.2597 11 19C11 20.1046 10.1046 21 9 21C7.89543 21 7 20.1046 7 19C7 18.2597 7.4022 17.6134 8 17.2676V6.73244C7.4022 6.38663 7 5.74028 7 5Z"/></svg><span>Fork</span>';
  b.onclick=async e=>{
    e.preventDefault();e.stopPropagation();
    const m=await createModal();
    document.body.appendChild(m);
    m.querySelector('#cancelFork').onclick=()=>m.remove();
    m.querySelector('#confirmFork').onclick=async()=>{
      const model=m.querySelector('select').value;
      const sum=m.querySelector('#summaryMode').checked;
      const cb=m.querySelector('#confirmFork');
      cb.disabled=true;cb.textContent='Processing...';
      await forkClicked(model,b,m,sum);
      m.remove();
    };
    m.onclick=e=>e.target===m&&m.remove();
  };
  return b;
};
const createModal=async()=>{
  const m=document.createElement('div');
  m.className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
  m.innerHTML='<div class="bg-bg-100 rounded-lg p-6 shadow-xl max-w-sm w-full mx-4 border border-border-300"><h3 class="text-lg font-semibold mb-4 text-text-100">Choose Model for Fork</h3><select class="w-full p-2 rounded mb-4 bg-bg-200 text-text-100 border border-border-300"><option value="claude-sonnet-4-20250514">Sonnet 4</option><option value="claude-opus-4-1-20250805">Opus 4.1</option><option value="claude-opus-4-20250514">Opus 4</option><option value="claude-3-7-sonnet-20250219">Sonnet 3.7</option><option value="claude-3-opus-20240229">Opus 3</option><option value="claude-3-5-haiku-20241022">Haiku 3.5</option></select><div class="mb-4 space-y-2"><div class="flex items-center justify-between mb-3 p-2 bg-bg-200 rounded"><span class="text-text-100 font-medium">Fork Type:</span><div class="flex items-center gap-4"><label class="flex items-center space-x-2"><input type="radio" id="fullChatlog" name="forkType" value="full" checked class="accent-accent-main-100"><span class="text-text-100">Full Chatlog</span></label><label class="flex items-center space-x-2"><input type="radio" id="summaryMode" name="forkType" value="summary" class="accent-accent-main-100"><span class="text-text-100">Summary</span></label></div></div><label class="flex items-center space-x-2"><input type="checkbox" id="includeFiles" class="rounded border-border-300" checked><span class="text-text-100">Include files</span></label></div><p class="text-sm text-text-400 sm:text-[0.75rem]">Note: Slow models like Opus may need page refresh to show response.</p><div class="mt-4 flex flex-col gap-2 sm:flex-row-reverse"><button class="inline-flex items-center justify-center relative shrink-0 ring-offset-2 ring-offset-bg-300 ring-accent-main-100 focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none disabled:drop-shadow-none bg-accent-main-100 bg-gradient-to-r from-accent-main-100 via-accent-main-200/50 to-accent-main-200 bg-[length:200%_100%] hover:bg-right active:bg-accent-main-000 border-0.5 border-border-300 text-oncolor-100 font-medium font-styrene drop-shadow-sm transition-all shadow-[inset_0_0.5px_0px_rgba(255,255,0,0.15)] [text-shadow:_0_1px_2px_rgb(0_0_0_/_10%)] active:shadow-[inset_0_1px_6px_rgba(0,0,0,0.2)] hover:from-accent-main-200 hover:to-accent-main-200 h-9 px-4 py-2 rounded-lg min-w-[5rem] active:scale-[0.985] whitespace-nowrap" id="confirmFork">Fork Chat</button><button class="inline-flex items-center justify-center relative shrink-0 ring-offset-2 ring-offset-bg-300 ring-accent-main-100 focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none disabled:drop-shadow-none bg-[radial-gradient(ellipse,_var(--tw-gradient-stops))] from-bg-500/10 from-50% to-bg-500/30 border-0.5 border-border-400 font-medium font-styrene text-text-100/90 transition-colors active:bg-bg-500/50 hover:text-text-000 hover:bg-bg-500/60 h-9 px-4 py-2 rounded-lg min-w-[5rem] active:scale-[0.985] whitespace-nowrap" id="cancelFork">Cancel</button></div></div>';
  try{
    const d=await fetch('/api/account/settings').then(r=>r.json());
    origSettings=d.settings;
  }catch(e){console.error('Failed to fetch settings:',e);}
  return m;
};
const findCtls=me=>{
  const g=me.closest('.group');
  const bs=g?.querySelectorAll('button');
  if(!bs)return null;
  const rb=Array.from(bs).find(b=>b.textContent.includes('Retry'));
  return rb?.closest('.justify-between');
};
const addBtns=()=>{
  if(isProc)return;
  try{
    isProc=true;
    document.querySelectorAll('.font-claude-response').forEach(m=>{
      const c=findCtls(m);
      if(c&&!c.querySelector('.branch-button')){
        const cont=document.createElement('div');
        cont.className='flex items-center gap-0.5';
        const div=document.createElement('div');
        div.className='w-px h-4/5 self-center bg-border-300 mr-0.5';
        cont.appendChild(createBtn());
        cont.appendChild(div);
        c.insertBefore(cont,c.firstChild);
      }
    });
  }catch(e){console.error('Error adding buttons:',e);}finally{isProc=false;}
};
// API helpers
const getCtx=async(oid,cid,mid)=>{
  const r=await fetch(`/api/organizations/${oid}/chat_conversations/${cid}?tree=False&rendering_mode=messages&render_all_tools=true`);
  const d=await r.json();
  const msgs=d.chat_messages.filter(m=>m.sender!=='system');
  const idx=msgs.findIndex(m=>m.uuid===mid);
  const sel=msgs.slice(0,idx+1);
  const atts=[],files=[],syncs=[];
  sel.forEach(m=>{
    m.attachments?.forEach(a=>atts.push(a));
    m.files?.forEach(f=>files.push(f));
    m.sync_sources?.forEach(s=>syncs.push(s));
  });
  return{messages:sel.map(m=>m.text||''),attachments:atts,files,syncsources:syncs,projectUuid:d.project_uuid};
};
const dlFiles=async fs=>Promise.all(fs.map(async f=>{
  const r=await fetch(f.url);
  const b=await r.blob();
  return new File([b],f.file_name,{type:f.file_type});
}));
const upFile=async(oid,f)=>{
  const fd=new FormData();fd.append('file',f);fd.append('orgUuid',oid);
  const r=await fetch(`/api/convert_document`,{method:'POST',body:fd});
  return r.json();
};
const procSync=async(oid,s)=>{
  if(s.is_external){
    const r=await fetch(`/api/organizations/${oid}/sources/${s.source_id}/syncs`,{method:'POST'});
    const d=await r.json();
    return{...s,source_sync_id:d.uuid};
  }
  return s;
};
const createConv=async(oid,name,model,puid,pap=false)=>{
  const r=await fetch(`/api/organizations/${oid}/chat_conversations`,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({uuid:crypto.randomUUID(),name,model,is_private_paprika_mode:pap,project_uuid:puid})
  });
  const d=await r.json();
  return d.uuid;
};
const createFork=async(oid,ctx,model,style)=>{
  const cid=await createConv(oid,`Fork_${Date.now()}`,model,ctx.projectUuid);
  let atts=[...ctx.attachments];
  if(ctx.messages){
    const log=ctx.messages.map((m,i)=>`${i%2===0?'User':'Assistant'}\n${m}`).join('\n\n');
    atts.push({extracted_content:log,file_name:"chatlog.txt",file_size:0,file_type:"text/plain"});
  }
  await fetch(`/api/organizations/${oid}/chat_conversations/${cid}/completion`,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({prompt:"Continue the conversation above. It is now your turn to reply.",parent_message_uuid:'00000000-0000-4000-8000-000000000000',attachments:atts,files:ctx.files,sync_sources:ctx.syncsources,personalized_styles:style})
  });
  return cid;
};
const genSum=async(oid,ctx)=>{
  const sid=await createConv(oid,`Temp_Sum_${Date.now()}`,null,ctx.projectUuid,true);
  try{
    const log=ctx.messages.map((m,i)=>`${i%2===0?'User':'Assistant'}\n${m}`).join('\n\n');
    const atts=[...ctx.attachments,{extracted_content:log,file_name:"chatlog.txt",file_size:0,file_type:"text/plain"}];
    await fetch(`/api/organizations/${oid}/chat_conversations/${sid}/completion`,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({prompt:"I've attached a chatlog from a previous conversation. Please create a complete, detailed summary of the conversation that covers all important points, questions, and responses. This summary will be used to continue the conversation in a new chat, so make sure it provides enough context to understand the full discussion. Be through, and think things through. Don't include any information already present in the other attachments, as those will be forwarded to the new chat as well.",parent_message_uuid:'00000000-0000-4000-8000-000000000000',attachments:atts,files:[],sync_sources:[]})
    });
    let txt=null;
    for(let i=0;i<6;i++){
      await new Promise(r=>setTimeout(r,5000));
      const r=await fetch(`/api/organizations/${oid}/chat_conversations/${sid}?tree=False&rendering_mode=messages&render_all_tools=true`);
      const d=await r.json();
      const am=d.chat_messages.find(m=>m.sender==='assistant');
      if(am){
        txt='';
        am.content.forEach(c=>{txt+=c.text||c.content?.text||'';});
        break;
      }
    }
    return txt;
  }finally{
    try{await fetch(`/api/organizations/${oid}/chat_conversations/${sid}`,{method:'DELETE'});}catch(e){}
  }
};
// Fork click handler
const forkClicked=async(model,btn,modal,sum=false)=>{
  const cid=window.location.pathname.split('/').pop();
  if(origSettings){
    const ns={...origSettings};
    ns.paprika_mode=null;
    await fetch('/api/account/settings',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({settings:ns})});
  }
  pendingFork=model;
  includeFiles=modal.querySelector('#includeFiles')?.checked??true;
  useSummary=sum;
  const bg=btn.closest('.justify-between');
  const rb=Array.from(bg.querySelectorAll('button')).find(b=>b.textContent.includes('Retry'));
  if(rb){
    rb.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,view:window,pointerType:'mouse'}));
    await new Promise(r=>setTimeout(r,300));
    const dd=document.querySelector('[role="menu"]');
    const nc=dd?.querySelector('[role="menuitemradio"]');
    nc?.click();
  }
};
// Fetch intercept
window.fetch=async(...args)=>{
  const[input,config]=args;
  let url;
  if(input instanceof URL)url=input.href;
  else if(typeof input==='string')url=input;
  else if(input instanceof Request)url=input.url;
  if(url?.includes('/retry_completion')&&pendingFork){
    const body=JSON.parse(config?.body);
    const mid=body?.parent_message_uuid;
    const parts=url.split('/');
    const oid=parts[parts.indexOf('organizations')+1];
    const cid=parts[parts.indexOf('chat_conversations')+1];
    const style=body?.personalized_styles;
    try{
      const ctx=await getCtx(oid,cid,mid);
      if(includeFiles){
        const dfs=await dlFiles(ctx.files);
        [ctx.files,ctx.syncsources]=await Promise.all([Promise.all(dfs.map(f=>upFile(oid,f))),Promise.all(ctx.syncsources.map(s=>procSync(oid,s)))]);
      }else{ctx.files=[];ctx.syncsources=[];}
      let ncid;
      if(useSummary){
        const sum=await genSum(oid,ctx,pendingFork);
        if(sum===null){
          ncid=await createFork(oid,ctx,pendingFork,style);
        }else{
          const sctx={...ctx};
          sctx.messages=null;
          sctx.attachments=[{extracted_content:sum,file_name:"conversation_summary.txt",file_size:0,file_type:"text/plain"}];
          ncid=await createFork(oid,sctx,pendingFork,style);
        }
      }else{
        ncid=await createFork(oid,ctx,pendingFork,style);
      }
      if(origSettings)await fetch('/api/account/settings',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({settings:origSettings})});
      window.location.href=`/chat/${ncid}`;
    }catch(e){
      console.error('Fork failed:',e);
      if(origSettings)await fetch('/api/account/settings',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({settings:origSettings})});
    }
    origSettings=null;
    pendingFork=null;
    useSummary=false;
    return new Response(JSON.stringify({success:true}));
  }
  return ogFetch(...args);
};
setInterval(addBtns,3000);
})();
