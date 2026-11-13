const TYPES = [
  ["question","Вопрос"],["thread","Мотив / нить"],["concept","Концепт"],
  ["emotion","Эмоция"],["prose","Художка"],["background","Бэкграунд"]
];
const VOLUMES = ["ПЛ","ДИ","ОВ","ПИ","АМ","МГ","ЭК"];
const MATURITY = ["Зародыш","Исследуется","Сформировано","Принято","Пересматривается"];
const PRIORITY = ["Ключевой","Высокий","Обычный","Низкий","Отложено"];
const RELATIONS = ["Зависимость","Повторение","Развитие","Отсылка / эхо","Противоречие","Общий концепт"];
const $ = id => document.getElementById(id);
let cards = [];
let db;
let currentView = "home";

function openDB(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open("spektry-workshop",1);
    req.onupgradeneeded=()=>req.result.createObjectStore("cards",{keyPath:"id"});
    req.onsuccess=()=>{db=req.result;resolve(db)};
    req.onerror=()=>reject(req.error);
  });
}
function saveAll(){
  return new Promise((resolve,reject)=>{
    const tx=db.transaction("cards","readwrite"), store=tx.objectStore("cards");
    store.clear(); cards.forEach(c=>store.put(c));
    tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error);
  });
}
function loadAll(){
  return new Promise((resolve,reject)=>{
    const req=db.transaction("cards").objectStore("cards").getAll();
    req.onsuccess=()=>resolve(req.result||[]); req.onerror=()=>reject(req.error);
  });
}
function id(){return crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random().toString(16).slice(2)}
function esc(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function typeName(v){return TYPES.find(x=>x[0]===v)?.[1]||v}
function byId(v){return cards.find(c=>c.id===v)}
function toast(msg){$("toast").textContent=msg;$("toast").classList.add("show");setTimeout(()=>$("toast").classList.remove("show"),2300)}
function selectOptions(el,items,first){el.innerHTML=(first?`<option value="">${first}</option>`:"")+items.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join("")}
function initFormOptions(){
  selectOptions($("cardType"),TYPES.map(x=>x[0]));
  $("cardType").innerHTML=TYPES.map(([v,n])=>`<option value="${v}">${n}</option>`).join("");
  selectOptions($("cardMaturity"),MATURITY);selectOptions($("cardPriority"),PRIORITY);
  $("volumeChecks").innerHTML=VOLUMES.map(v=>`<label class="volume-option"><input type="checkbox" value="${v}"><span>${v}</span></label>`).join("");
  selectOptions($("typeFilter"),TYPES.map(x=>x[0]),"Все типы");
  $("typeFilter").innerHTML='<option value="">Все типы</option>'+TYPES.map(([v,n])=>`<option value="${v}">${n}</option>`).join("");
  selectOptions($("volumeFilter"),VOLUMES,"Все тома");
}
function nav(name){
  currentView=name;
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  $(`${name}View`).classList.add("active");
  document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.nav===name));
  render();
  window.scrollTo({top:0,behavior:"smooth"});
}
function cardHTML(c){
  const pcls=c.priority==="Ключевой"?"priority-key":c.priority==="Высокий"?"priority-high":"";
  const volumes=(c.volumes||[]).map(v=>`<span class="pill">${v}</span>`).join("");
  const wait=c.waitingOn?`<span class="pill wait">◷ Ожидает: ${esc(byId(c.waitingOn)?.title||"другое решение")}</span>`:"";
  return `<article class="card-item">
    <div class="card-top"><div><div class="card-meta"><span class="pill type">${esc(typeName(c.type))}</span>${volumes}</div><h3 class="card-title">${esc(c.title)}</h3></div><button class="open-card" data-edit="${c.id}">Открыть ↗</button></div>
    ${c.body?`<div class="card-summary">${esc(c.body.slice(0,260))}${c.body.length>260?"…":""}</div>`:""}
    <div class="card-meta"><span class="pill">${esc(c.maturity||"Исследуется")}</span><span class="pill ${pcls}">${esc(c.priority||"Обычный")}</span>${wait}</div>
    <div class="card-footer"><span>${esc(c.episode||"Без привязки к эпизоду")}</span><span>${(c.connections||[]).length} связей</span></div>
  </article>`;
}
function renderList(target,items,empty){
  $(target).innerHTML=items.length?items.map(cardHTML).join(""):`<div class="empty-state">${empty}</div>`;
}
function render(){
  $("cardCount").textContent=`${cards.length} ${plural(cards.length,"карточка","карточки","карточек")}`;
  renderList("recentCards",[...cards].sort((a,b)=>(b.updated||0)-(a.updated||0)).slice(0,3),"Здесь пока тихо. Создай первую карточку — и она появится здесь.");
  const q=($("searchInput")?.value||"").toLowerCase(), t=$("typeFilter")?.value||"", v=$("volumeFilter")?.value||"", p=$("priorityFilter")?.value||"";
  const filtered=cards.filter(c=>(!q||[c.title,c.body,c.notes,c.episode].join(" ").toLowerCase().includes(q))&&(!t||c.type===t)&&(!v||(c.volumes||[]).includes(v))&&(!p||c.priority===p)).sort((a,b)=>(b.updated||0)-(a.updated||0));
  renderList("libraryCards",filtered,"Пока нет карточек по этим условиям. Попробуй изменить фильтры или создать новую.");
  const connected=cards.filter(c=>(c.connections||[]).length);
  $("connectionList").innerHTML=connected.length?connected.map(c=>`<article class="card-item"><h3 class="card-title">${esc(c.title)}</h3>${c.connections.map(r=>`<div class="connection-detail"><strong>${esc(r.kind)}</strong> → ${esc(byId(r.target)?.title||"Карточка не найдена")}<br>${esc(r.description||"Без пояснения")}</div>`).join("")}<div class="card-footer"><span>${esc(typeName(c.type))}</span><button class="open-card" data-edit="${c.id}">Открыть ↗</button></div></article>`).join(""):`<div class="empty-state">Связи появятся здесь, когда карточки начнут разговаривать друг с другом.</div>`;
  const waiting=cards.filter(c=>c.waitingOn);
  renderList("waitingList",waiting,"Нет карточек, ожидающих другого решения.");
  const threads=cards.filter(c=>c.type==="thread");
  renderList("threadList",threads,"Пока нет отдельных карточек-мотивов. Можно начать с нити, которая соединяет два тома.");
  document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>openEditor(b.dataset.edit));
  document.querySelectorAll("[data-filter-type]").forEach(b=>b.onclick=()=>{nav("library");$("typeFilter").value=b.dataset.filterType;render()});
}
function plural(n,a,b,c){let m=n%10,k=n%100;return m===1&&k!==11?a:m>=2&&m<=4&&(k<12||k>14)?b:c}
function openEditor(cardId){
  const c=cardId?byId(cardId):null;
  $("cardForm").reset();$("cardId").value=c?.id||"";
  $("dialogTitle").textContent=c?"Редактировать карточку":"Новая карточка";
  $("cardTitle").value=c?.title||"";$("cardType").value=c?.type||"question";$("cardBody").value=c?.body||"";
  $("cardMaturity").value=c?.maturity||"Исследуется";$("cardPriority").value=c?.priority||"Обычный";
  $("cardEpisode").value=c?.episode||"";$("cardNotes").value=c?.notes||"";
  document.querySelectorAll("#volumeChecks input").forEach(i=>i.checked=(c?.volumes||[]).includes(i.value));
  $("cardWaiting").checked=!!c?.waitingOn;populateWaiting(c?.id);$("waitingTarget").value=c?.waitingOn||"";
  $("waitingTargetWrap").hidden=!$("cardWaiting").checked;
  $("connectionsEditor").innerHTML="";(c?.connections||[]).forEach(addConnectionRow);
  $("deleteCard").hidden=!c;
  $("cardDialog").showModal();$("cardTitle").focus();
}
function populateWaiting(exclude){
  const options=cards.filter(c=>c.id!==exclude).map(c=>`<option value="${c.id}">${esc(c.title)}</option>`).join("");
  $("waitingTarget").innerHTML='<option value="">Выбрать карточку…</option>'+options;
}
function addConnectionRow(data={}){
  const row=document.createElement("div");row.className="connection-row";
  row.innerHTML=`<select class="field rel-kind">${RELATIONS.map(r=>`<option ${r===data.kind?"selected":""}>${r}</option>`).join("")}</select>
    <select class="field rel-target"><option value="">Выбрать карточку…</option>${cards.filter(c=>c.id!==$("cardId").value).map(c=>`<option value="${c.id}" ${c.id===data.target?"selected":""}>${esc(c.title)}</option>`).join("")}</select>
    <button type="button" class="icon-btn remove-rel" aria-label="Убрать связь">×</button>
    <input class="field connection-description" placeholder="Что именно связывает карточки?" value="${esc(data.description||"")}">`;
  row.querySelector(".remove-rel").onclick=()=>row.remove();$("connectionsEditor").append(row);
}
$("cardWaiting").addEventListener("change",()=>{$("waitingTargetWrap").hidden=!$("cardWaiting").checked});
$("addConnection").onclick=()=>addConnectionRow();
$("newCardHome").onclick=$("newCardNav").onclick=()=>openEditor();
$("closeDialog").onclick=$("cancelDialog").onclick=()=>$("cardDialog").close();
$("deleteCard").onclick=async()=>{
  const cid=$("cardId").value;if(!cid)return;
  if(!confirm("Удалить карточку? Связи с ней в других карточках останутся и будут показаны как отсутствующие."))return;
  cards=cards.filter(c=>c.id!==cid);await saveAll();$("cardDialog").close();render();toast("Карточка удалена");
};
$("cardForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const cid=$("cardId").value, old=byId(cid);
  const connections=[...$("connectionsEditor").querySelectorAll(".connection-row")].map(r=>({kind:r.querySelector(".rel-kind").value,target:r.querySelector(".rel-target").value,description:r.querySelector(".connection-description").value.trim()})).filter(r=>r.target);
  const c={id:cid||id(),title:$("cardTitle").value.trim(),type:$("cardType").value,body:$("cardBody").value.trim(),maturity:$("cardMaturity").value,priority:$("cardPriority").value,volumes:[...document.querySelectorAll("#volumeChecks input:checked")].map(i=>i.value),episode:$("cardEpisode").value.trim(),waitingOn:$("cardWaiting").checked?$("waitingTarget").value:"",connections,notes:$("cardNotes").value.trim(),created:old?.created||Date.now(),updated:Date.now()};
  if(old)cards=cards.map(x=>x.id===cid?c:x);else cards.unshift(c);
  await saveAll();$("cardDialog").close();render();toast(old?"Изменения сохранены":"Карточка создана");
});
["searchInput","typeFilter","volumeFilter","priorityFilter"].forEach(id=>$ (id).addEventListener("input",render));
document.querySelectorAll("[data-nav]").forEach(b=>b.addEventListener("click",()=>nav(b.dataset.nav)));
$("homeLink").onclick=e=>{e.preventDefault();nav("home")};
$("themeBtn").onclick=()=>{document.body.classList.toggle("light");localStorage.setItem("spektry-theme",document.body.classList.contains("light")?"light":"dark");$("themeBtn").textContent=document.body.classList.contains("light")?"☾":"☼"};
$("exportBtn").onclick=()=>{
  const blob=new Blob([JSON.stringify({app:"spektry-workshop",version:1,exported:new Date().toISOString(),cards},null,2)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`spektry-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);toast("Резервная копия подготовлена");
};
$("importInput").onchange=async e=>{
  const f=e.target.files[0];if(!f)return;
  try{const data=JSON.parse(await f.text());if(!Array.isArray(data.cards))throw Error("bad");
    if(!confirm(`Импортировать ${data.cards.length} карточек? Текущая библиотека будет заменена.`))return;
    cards=data.cards;await saveAll();render();toast("Библиотека импортирована");
  }catch{toast("Не удалось прочитать файл резервной копии")}e.target.value="";
};
async function start(){
  if(localStorage.getItem("spektry-theme")==="light"){document.body.classList.add("light");$("themeBtn").textContent="☾"}
  initFormOptions();
  try{await openDB();cards=await loadAll()}catch(err){toast("Не удалось открыть локальное хранилище")}
  render();
  if("serviceWorker" in navigator)navigator.serviceWorker.register("./sw.js").catch(()=>{});
}
start();
