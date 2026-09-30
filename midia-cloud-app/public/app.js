const $=(s)=>document.querySelector(s);
const state={user:null,folderId:null,search:"",uploads:[],uploading:false,poll:null};
const els={
authView:$("#authView"),appView:$("#appView"),authForm:$("#authForm"),emailInput:$("#emailInput"),codeInput:$("#codeInput"),codeLabel:$("#codeLabel"),authButton:$("#authButton"),changeEmail:$("#changeEmail"),authMessage:$("#authMessage"),
sidebar:$("#sidebar"),openMenu:$("#openMenu"),closeMenu:$("#closeMenu"),backdrop:$("#backdrop"),sideUpload:$("#sideUpload"),rootButton:$("#rootButton"),logoutButton:$("#logoutButton"),userEmail:$("#userEmail"),userRole:$("#userRole"),
searchInput:$("#searchInput"),jobsButton:$("#jobsButton"),jobsCount:$("#jobsCount"),adminButton:$("#adminButton"),
breadcrumbs:$("#breadcrumbs"),pageTitle:$("#pageTitle"),pageSubtitle:$("#pageSubtitle"),uploadHere:$("#uploadHere"),newFolder:$("#newFolder"),fileInput:$("#fileInput"),
uploadPanel:$("#uploadPanel"),uploadSummary:$("#uploadSummary"),uploadList:$("#uploadList"),hideUploads:$("#hideUploads"),
loading:$("#loading"),empty:$("#empty"),foldersSection:$("#foldersSection"),folderGrid:$("#folderGrid"),folderCount:$("#folderCount"),assetsSection:$("#assetsSection"),assetGrid:$("#assetGrid"),assetCount:$("#assetCount"),
folderDialog:$("#folderDialog"),folderForm:$("#folderForm"),folderName:$("#folderName"),cancelFolder:$("#cancelFolder"),
adminDialog:$("#adminDialog"),closeAdmin:$("#closeAdmin"),inviteForm:$("#inviteForm"),inviteEmail:$("#inviteEmail"),inviteMessage:$("#inviteMessage"),inviteList:$("#inviteList"),telegramForm:$("#telegramForm"),telegramToken:$("#telegramToken"),telegramStatus:$("#telegramStatus"),telegramMessage:$("#telegramMessage"),
confirmDialog:$("#confirmDialog"),confirmTitle:$("#confirmTitle"),confirmText:$("#confirmText"),toast:$("#toast")
};

function fmt(bytes){const n=Number(bytes||0);if(!n)return"0 B";const u=["B","KB","MB","GB","TB"];const i=Math.min(Math.floor(Math.log(n)/Math.log(1024)),u.length-1);const v=n/Math.pow(1024,i);return`${v>=10||i===0?v.toFixed(0):v.toFixed(1)} ${u[i]}`;}
function notify(msg,err=false){els.toast.textContent=msg;els.toast.classList.remove("hidden");els.toast.classList.toggle("error",err);clearTimeout(notify.t);notify.t=setTimeout(()=>els.toast.classList.add("hidden"),4200);}
async function api(path,opt={}){const r=await fetch(path,opt);const ct=r.headers.get("content-type")||"";const body=ct.includes("application/json")?await r.json().catch(()=>({})):null;if(r.status===401){showAuth();throw new Error("Sessão expirada.");}if(!r.ok)throw new Error(body?.error||`Erro HTTP ${r.status}`);return body;}
function showAuth(){els.authView.classList.remove("hidden");els.appView.classList.add("hidden");}
function showApp(){els.authView.classList.add("hidden");els.appView.classList.remove("hidden");}
function authMsg(text,error=false){els.authMessage.textContent=text;els.authMessage.classList.remove("hidden");els.authMessage.classList.toggle("error",error);}
let authStep="email";

async function init(){
  try{
    const me=await api("/api/me");
    state.user=me.user;
    enterApp();
  }catch{}
}
function enterApp(){
  showApp();
  els.userEmail.textContent=state.user.email;
  els.userRole.textContent=state.user.admin?"Administrador":"Equipe";
  els.adminButton.classList.toggle("hidden",!state.user.admin);
  loadLibrary();
}
els.authForm.addEventListener("submit",async e=>{
  e.preventDefault();els.authButton.disabled=true;els.authMessage.classList.add("hidden");
  try{
    if(authStep==="email"){
      const email=els.emailInput.value.trim().toLowerCase();
      await api("/api/auth/start",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email})});
      authStep="code";els.codeLabel.classList.remove("hidden");els.codeInput.required=true;els.authButton.textContent="Entrar";els.changeEmail.classList.remove("hidden");authMsg("Código enviado para seu e-mail.");els.codeInput.focus();
    }else{
      const email=els.emailInput.value.trim().toLowerCase();
      const token=els.codeInput.value.trim();
      const r=await api("/api/auth/verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,token})});
      state.user=r.user;enterApp();
    }
  }catch(err){authMsg(err.message,true);}finally{els.authButton.disabled=false;}
});
els.changeEmail.addEventListener("click",()=>{authStep="email";els.codeLabel.classList.add("hidden");els.codeInput.required=false;els.codeInput.value="";els.authButton.textContent="Receber código";els.changeEmail.classList.add("hidden");els.authMessage.classList.add("hidden");});
els.logoutButton.addEventListener("click",async()=>{await fetch("/api/logout",{method:"POST"});location.reload();});

function openMenu(){els.sidebar.classList.add("open");els.backdrop.classList.remove("hidden");}
function closeMenu(){els.sidebar.classList.remove("open");els.backdrop.classList.add("hidden");}
els.openMenu.addEventListener("click",openMenu);els.closeMenu.addEventListener("click",closeMenu);els.backdrop.addEventListener("click",closeMenu);

async function loadLibrary(){
  els.loading.classList.remove("hidden");els.empty.classList.add("hidden");els.foldersSection.classList.add("hidden");els.assetsSection.classList.add("hidden");
  try{
    const q=new URLSearchParams();if(state.folderId)q.set("folder",state.folderId);if(state.search)q.set("q",state.search);
    const data=await api("/api/library"+(q.toString()?"?"+q:""));
    renderLibrary(data);
  }catch(err){notify(err.message,true);}finally{els.loading.classList.add("hidden");}
}
function renderLibrary(data){
  els.breadcrumbs.innerHTML="";
  const root=document.createElement("button");root.textContent="Meu armazenamento";root.onclick=()=>openFolder(null);els.breadcrumbs.append(root);
  for(const c of data.breadcrumbs||[]){els.breadcrumbs.append(document.createTextNode("›"));const b=document.createElement("button");b.textContent=c.name;b.onclick=()=>openFolder(c.id);els.breadcrumbs.append(b);}
  els.pageTitle.textContent=state.search?`Resultados para “${state.search}”`:(data.folder?.name||"Meu armazenamento");
  els.pageSubtitle.textContent=state.search?"Busca em toda a biblioteca.":"MOV e MP4 no mesmo lugar, com conversão no servidor.";
  const folders=data.folders||[],assets=data.assets||[];
  els.folderGrid.innerHTML="";els.assetGrid.innerHTML="";
  if(folders.length){els.foldersSection.classList.remove("hidden");els.folderCount.textContent=`${folders.length} pasta${folders.length===1?"":"s"}`;folders.forEach(renderFolder);}else els.foldersSection.classList.add("hidden");
  if(assets.length){els.assetsSection.classList.remove("hidden");els.assetCount.textContent=`${assets.length} vídeo${assets.length===1?"":"s"}`;assets.forEach(renderAsset);}else els.assetsSection.classList.add("hidden");
  els.empty.classList.toggle("hidden",folders.length+assets.length>0);
  const jobs=assets.filter(a=>a.job&&["pending","running"].includes(a.job.status));
  els.jobsButton.classList.toggle("hidden",jobs.length===0);els.jobsCount.textContent=String(jobs.length);
  if(jobs.length)startPolling();else stopPolling();
}
function renderFolder(f){
  const card=document.createElement("div");card.className="folder-card";card.innerHTML=`<div class="folder-icon">▰</div><div class="folder-copy"><strong></strong><span>Pasta</span></div><button class="delete-icon" title="Excluir pasta">🗑</button>`;card.querySelector("strong").textContent=f.name;card.onclick=e=>{if(e.target.closest(".delete-icon"))return;openFolder(f.id);};card.querySelector(".delete-icon").onclick=()=>deleteFolder(f);els.folderGrid.append(card);
}
function renderAsset(a){
  const card=document.createElement("article");card.className="asset-card";
  const readyMov=(a.variants||[]).find(v=>v.format==="mov"&&v.status==="ready");
  const readyMp4=(a.variants||[]).find(v=>v.format==="mp4"&&v.status==="ready");
  const head=document.createElement("div");head.className="asset-head";head.innerHTML=`<div class="video-icon">▶</div><div class="asset-title"><strong></strong><span></span></div>`;head.querySelector("strong").textContent=a.original_name;const orig=(a.variants||[]).find(v=>v.format===a.original_format&&v.status==="ready");head.querySelector("span").textContent=`${fmt(orig?.size_bytes||0)} · enviado por ${a.uploaded_by}`;card.append(head);
  const variants=document.createElement("div");variants.className="variant-row";
  if(readyMov)variants.append(badge("MOV",true,readyMov));
  if(readyMp4)variants.append(badge("MP4",true,readyMp4));
  if(!readyMov&&!readyMp4)variants.append(badge("Processando upload",false));
  card.append(variants);
  if(a.job&&["pending","running"].includes(a.job.status)){const box=document.createElement("div");box.className="job-box";const pct=Number(a.job.progress||0);box.innerHTML=`<div class="job-top"><span>Gerando ${String(a.job.target_format).toUpperCase()}</span><strong>${pct}%</strong></div><div class="track"><div class="bar" style="width:${pct}%"></div></div>`;card.append(box);}
  const actions=document.createElement("div");actions.className="asset-actions";
  if(readyMov)actions.append(action("↓ Baixar MOV",()=>download(a.id,"mov")));
  else if(!a.job)actions.append(action("Gerar MOV",()=>convert(a.id,"mov"),"convert"));
  if(readyMp4)actions.append(action("↓ Baixar MP4",()=>download(a.id,"mp4")));
  else if(!a.job)actions.append(action("Gerar MP4",()=>convert(a.id,"mp4"),"convert"));
  actions.append(action("🗑",()=>deleteAsset(a),"delete"));card.append(actions);els.assetGrid.append(card);
}
function badge(label,ready,v){const b=document.createElement("span");b.className="badge"+(ready?" ready":"");b.textContent=ready?`${label} · ${fmt(v.size_bytes)}`:label;return b;}
function action(label,fn,cls=""){const b=document.createElement("button");b.className="asset-action "+cls;b.textContent=label;b.onclick=fn;return b;}
function openFolder(id){state.folderId=id||null;state.search="";els.searchInput.value="";closeMenu();loadLibrary();}
els.rootButton.addEventListener("click",()=>openFolder(null));els.breadcrumbs.addEventListener("click",e=>{if(e.target.matches("[data-root]"))openFolder(null);});
let searchTimer;els.searchInput.addEventListener("input",()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{state.search=els.searchInput.value.trim();loadLibrary();},420);});

els.newFolder.addEventListener("click",()=>{els.folderName.value="";els.folderDialog.showModal();setTimeout(()=>els.folderName.focus(),60);});
els.cancelFolder.addEventListener("click",()=>els.folderDialog.close());
els.folderForm.addEventListener("submit",async e=>{e.preventDefault();try{await api("/api/folders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:els.folderName.value,parentId:state.folderId})});els.folderDialog.close();loadLibrary();}catch(err){notify(err.message,true);}});

function confirmAction(title,text){els.confirmTitle.textContent=title;els.confirmText.textContent=text;els.confirmDialog.showModal();return new Promise(resolve=>{const handler=()=>{els.confirmDialog.removeEventListener("close",handler);resolve(els.confirmDialog.returnValue==="ok");};els.confirmDialog.addEventListener("close",handler);});}
async function deleteAsset(a){if(!(await confirmAction("Excluir vídeo",`Excluir “${a.original_name}” e todas as variantes MOV/MP4?`)))return;try{await api("/api/assets/"+a.id,{method:"DELETE"});notify("Vídeo excluído.");loadLibrary();}catch(err){notify(err.message,true);}}
async function deleteFolder(f){if(!(await confirmAction("Excluir pasta",`Excluir a pasta “${f.name}” e todo o conteúdo dentro dela?`)))return;try{await api("/api/folders/"+f.id,{method:"DELETE"});notify("Pasta excluída.");loadLibrary();}catch(err){notify(err.message,true);}}

els.sideUpload.addEventListener("click",()=>els.fileInput.click());els.uploadHere.addEventListener("click",()=>els.fileInput.click());els.fileInput.addEventListener("change",()=>queueUploads([...els.fileInput.files]));
els.hideUploads.addEventListener("click",()=>els.uploadPanel.classList.add("hidden"));
function queueUploads(files){const valid=files.filter(f=>/\.(mov|mp4)$/i.test(f.name));if(!valid.length)return;for(const file of valid){state.uploads.push({id:crypto.randomUUID(),file,status:"queued",progress:0,detail:"Na fila"});}els.uploadPanel.classList.remove("hidden");renderUploads();processUploads();els.fileInput.value="";}
function renderUploads(){els.uploadList.innerHTML="";const pending=state.uploads.filter(x=>x.status!=="done").length;const done=state.uploads.filter(x=>x.status==="done").length;els.uploadSummary.textContent=`${pending} pendente${pending===1?"":"s"} · ${done} concluído${done===1?"":"s"}`;for(const item of state.uploads){const row=document.createElement("div");row.className="upload-row";row.innerHTML=`<div class="upload-icon">▶</div><div class="upload-info"><div class="upload-top"><strong></strong><span></span></div><div class="track"><div class="bar"></div></div><small></small></div>`;row.querySelector("strong").textContent=item.file.name;row.querySelector("span").textContent=item.status==="done"?"Concluído":item.status==="failed"?"Falhou":item.status==="uploading"?"Enviando":"Na fila";row.querySelector(".bar").style.width=item.progress+"%";row.querySelector("small").textContent=item.detail||fmt(item.file.size);els.uploadList.append(row);}}
async function processUploads(){if(state.uploading)return;state.uploading=true;try{while(true){const next=state.uploads.find(x=>x.status==="queued");if(!next)break;await uploadOne(next);}}finally{state.uploading=false;renderUploads();loadLibrary();}}
async function uploadOne(item){item.status="uploading";renderUploads();try{const start=await api("/api/upload/start",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:item.file.name,size:item.file.size,folderId:state.folderId})});for(let part=0;part<start.chunkCount;part++){const begin=part*start.chunkSize,end=Math.min(item.file.size,begin+start.chunkSize);item.detail=`Parte ${part+1} de ${start.chunkCount}`;renderUploads();const r=await fetch(`/api/upload/${start.variantId}/chunk/${part}`,{method:"PUT",headers:{"Content-Type":"application/octet-stream"},body:item.file.slice(begin,end)});const body=await r.json().catch(()=>({}));if(!r.ok)throw new Error(body.error||"Falha no upload.");item.progress=Math.round(((part+1)/start.chunkCount)*95);renderUploads();}await api(`/api/upload/${start.variantId}/finish`,{method:"POST"});item.progress=100;item.status="done";item.detail="Disponível na nuvem";notify(item.file.name+" enviado.");}catch(err){item.status="failed";item.detail=err.message;notify(`${item.file.name}: ${err.message}`,true);}renderUploads();}

async function convert(id,target){try{await api(`/api/assets/${id}/convert`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({target})});notify(`Conversão para ${target.toUpperCase()} entrou na fila do servidor.`);loadLibrary();startPolling();}catch(err){notify(err.message,true);}}
function download(id,format){location.href=`/api/assets/${id}/download/${format}`;}
function startPolling(){if(state.poll)return;state.poll=setInterval(()=>loadLibrary(),3500);}
function stopPolling(){if(state.poll){clearInterval(state.poll);state.poll=null;}}
els.jobsButton.addEventListener("click",()=>{document.querySelector(".job-box")?.scrollIntoView({behavior:"smooth",block:"center"});});

els.adminButton.addEventListener("click",async()=>{els.adminDialog.showModal();await Promise.all([loadInvites(),loadTelegramStatus()]);});
els.closeAdmin.addEventListener("click",()=>els.adminDialog.close());
els.inviteForm.addEventListener("submit",async e=>{e.preventDefault();try{const r=await api("/api/admin/invite",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:els.inviteEmail.value.trim()})});els.inviteMessage.textContent=r.email+" autorizado.";els.inviteMessage.classList.remove("hidden","error");els.inviteEmail.value="";loadInvites();}catch(err){els.inviteMessage.textContent=err.message;els.inviteMessage.classList.remove("hidden");els.inviteMessage.classList.add("error");}});
async function loadInvites(){try{const r=await api("/api/admin/invites");els.inviteList.innerHTML="";for(const x of r.emails){const d=document.createElement("div");d.className="invite-item";d.textContent=x.email;els.inviteList.append(d);}}catch(err){notify(err.message,true);}}
init();

async function loadTelegramStatus(){
  try{
    const r=await api("/api/admin/telegram");
    if(r.configured){
      els.telegramStatus.textContent="Conectado ao "+(r.channel?.title||"canal privado")+".";
      els.telegramStatus.style.color="var(--green)";
    }else if(r.channel){
      els.telegramStatus.textContent="Canal encontrado. Falta conectar o token do bot.";
      els.telegramStatus.style.color="var(--amber)";
    }else{
      els.telegramStatus.textContent="Telegram ainda não configurado.";
      els.telegramStatus.style.color="var(--muted)";
    }
  }catch(err){
    els.telegramStatus.textContent=err.message;
    els.telegramStatus.style.color="var(--red)";
  }
}
els.telegramForm.addEventListener("submit",async e=>{
  e.preventDefault();
  els.telegramMessage.classList.add("hidden");
  const btn=els.telegramForm.querySelector("button");
  btn.disabled=true;
  try{
    const r=await api("/api/admin/telegram",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({token:els.telegramToken.value.trim()})
    });
    els.telegramToken.value="";
    els.telegramMessage.textContent="Bot @"+(r.bot?.username||"Telegram")+" conectado com sucesso.";
    els.telegramMessage.classList.remove("hidden","error");
    await loadTelegramStatus();
  }catch(err){
    els.telegramMessage.textContent=err.message;
    els.telegramMessage.classList.remove("hidden");
    els.telegramMessage.classList.add("error");
  }finally{
    btn.disabled=false;
  }
});