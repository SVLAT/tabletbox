"use strict";
const C=SvodCore, $=id=>document.getElementById(id);
const esc=value=>String(value??"").replace(/[&<>"']/g,x=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[x]));
const symbols={
  plus:"M12 5v14M5 12h14",close:"m6 6 12 12m0-12L6 18",chevron:"m9 5 7 7-7 7",back:"m15 5-7 7 7 7",
  calendar:"M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm2-3v6m10-6v6M3 10h18m-13 4h1m4 0h1",
  home:"m2 11 10-8 10 8M5 9v12h5v-6h4v6h5V9",car:"m2 14 2-5h10l4 4 3 1v4h-2m-4 0H8m-4 0H2v-4Zm6 4a2 2 0 1 1-4 0 2 2 0 1 1 4 0Zm11 0a2 2 0 1 1-4 0 2 2 0 1 1 4 0Z",
  food:"M5 3v6q0 3 3 3t3-3V3M8 3v18m10 0V3q-5 3-4 10h4",other:"M4 12h1m6 0h1m6 0h1",
  mic:"M9 5a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0V5Zm-4 6a7 7 0 0 0 14 0m-7 7v4m-3 0h6",check:"m4 12 5 5L20 6"
};
const icon=id=>'<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="'+(id==="other"?'3.4':'1.8')+'" stroke-linecap="round" stroke-linejoin="round"><path d="'+symbols[id]+'"/></svg>';
document.querySelectorAll("[data-icon]").forEach(el=>el.innerHTML=icon(el.dataset.icon));
const fmt=new Intl.NumberFormat("ru-RU",{maximumFractionDigits:2});
const amount=c=>fmt.format(c/100);
const displayDate=(iso,opts)=>C.local(iso).toLocaleDateString("ru-RU",opts);
const newId=()=>globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2);
const blank=()=>({version:1,expenses:[],tasks:[]});
let selected=C.day(),month=selected.slice(0,7),category=null,toastTimer,voiceSession=null;
let demo=false,data=blank(),busy=false,account=null,epoch=0,authBusy=false,readNonce=0,identityFailed=false;
const marker="svod.active.account.v1";
function markerValue(){try{return localStorage.getItem(marker);}catch{return null;}}
function mark(value){try{if(value)localStorage.setItem(marker,value);else localStorage.removeItem(marker);}catch{}}
function sample(){
  const expenses=[["Аренда","home",162000],["Заправка","car",81000],["Продукты","food",48600],["Покупки","other",32400]].map(([name,category,cents])=>({id:newId(),name,category,cents,date:C.day()}));
  return {version:1,expenses,tasks:["Позвонить в сервис","Пополнить Salik","Оплатить e&"].map(name=>({id:newId(),name,date:C.day(),done:false}))};
}
function notify(text){$("toast").textContent=text;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$("toast").textContent="",3500);}
function report(text){const el=$("formError");if($("sheet").open&&el){el.textContent=text;}else notify(text);}
async function change(fn){
  if(busy||(!demo&&!account))return false;
  const session=account,stamp=epoch;
  busy=true;readNonce++;
  try{
    const next=JSON.parse(JSON.stringify(data));
    fn(next);
    if(session)await session.save(data,next);
    if(stamp!==epoch)return false;
    data=next;render();return true;
  }catch(e){
    if(stamp===epoch)report(e instanceof Error?e.message:"Сохранение не подтверждено. Проверь интернет и попробуй ещё раз.");
    return false;
  }finally{if(stamp===epoch)busy=false;}
}
const catBy=id=>C.categories.find(c=>c.id===id)||C.categories[3];
const badge=c=>'<span class="badge" style="color:'+c.color+'">'+icon(c.icon)+'</span>';
function render(){
  $("mode").textContent=demo?"Демо · Войти":account?.user.username||"Мой аккаунт";
  $("heading").textContent=selected===C.day()?"Сегодня":displayDate(selected,{day:"numeric",month:"long"});
  $("dateLabel").textContent=displayDate(selected,{weekday:"long",day:"numeric",month:"long"});
  $("monthLabel").textContent=displayDate(month+"-01",{month:"long",...(month.slice(0,4)!==C.day().slice(0,4)?{year:"numeric"}:{})});
  const list=data.expenses.filter(e=>e.date.startsWith(month)),sums=C.categories.map(c=>list.reduce((s,e)=>s+(e.category===c.id?e.cents:0),0)),total=sums.reduce((s,n)=>s+n,0);
  $("total").textContent=amount(total);
  const selectedIndex=category?C.categories.findIndex(c=>c.id===category):sums.indexOf(Math.max(...sums));
  const focus=C.categories[selectedIndex];let start=-Math.PI/2,arcs="";
  sums.forEach((n,i)=>{if(!n)return;const sweep=n/total*2*Math.PI,r=44,space=Math.min(.12,sweep*.2),end=start+sweep;
    if(n===total)arcs+='<circle cx="50" cy="50" r="44" stroke="'+C.categories[i].color+'"/>';
    else{const a=start+space/2,b=end-space/2;arcs+='<path d="M '+(50+r*Math.cos(a))+' '+(50+r*Math.sin(a))+' A 44 44 0 '+(b-a>Math.PI?1:0)+' 1 '+(50+r*Math.cos(b))+' '+(50+r*Math.sin(b))+'" stroke="'+C.categories[i].color+'"/>';}start=end;});
  const pct=total?Math.round(sums[selectedIndex]/total*100):0;
  $("ring").innerHTML='<svg aria-hidden="true" viewBox="0 0 100 100" fill="none"><circle cx="50" cy="50" r="34" stroke="#2c3646" stroke-width=".6"/><g stroke-width="8"><circle cx="50" cy="50" r="44" stroke="#242d3a"/>'+arcs+'</g></svg><div><b>'+pct+'%</b><small>'+(total?focus.name:"Расходов")+'</small></div>';
  $("legend").innerHTML=C.categories.map((c,i)=>'<button class="cat '+(category===c.id?'active':'')+'" data-cat="'+c.id+'" aria-pressed="'+(category===c.id)+'" aria-label="'+c.name+', '+amount(sums[i])+' AED, показать долю">'+badge(c)+'<span class="catname">'+c.name+'</span><b>'+amount(sums[i])+'</b></button>').join("");
  const tasks=data.tasks.filter(t=>t.date===selected);
  $("taskList").innerHTML=tasks.map(t=>'<div class="taskrow '+(t.done?'done':'')+'"><button class="check" data-toggle="'+esc(t.id)+'" aria-label="'+(t.done?'Вернуть задачу':'Завершить задачу')+' '+esc(t.name)+'" aria-pressed="'+t.done+'"><span>'+(t.done?icon("check"):'')+'</span></button><button class="taskname" data-task="'+esc(t.id)+'">'+esc(t.name)+'</button></div>').join("")||'<p class="empty">На этот день задач пока нет.</p>';
}
const errorSlot='<p class="error" role="alert" id="formError"></p>';
function endVoice(){voiceSession?.dispose();voiceSession=null;}
function show(title,html){endVoice();$("sheetTitle").textContent=title;$("sheetBody").innerHTML=html;if(!$("sheet").open)$("sheet").showModal();$("sheet").scrollTop=0;}
function close(){endVoice();$("sheet").close();}
$("close").onclick=close;$("sheet").addEventListener("close",()=>{if(!$("sheet").open)endVoice();});
window.addEventListener("pagehide",()=>{if(voiceSession)close();});
$("sheet").onclick=e=>{if(e.target===$("sheet")){const r=$("sheet").getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}};
function accountScreen(message="",error=false){
  epoch++;readNonce++;account?.close();account=null;demo=false;data=blank();
  busy=false;authBusy=false;endVoice();
  if($("sheet").open)close();
  $("sheetBody").replaceChildren();$("sheetTitle").textContent="";
  $("toast").textContent="";category=null;selected=C.day();month=selected.slice(0,7);
  $("workspace").hidden=true;$("mode").hidden=true;$("welcome").hidden=false;
  $("enter").disabled=!globalThis.puter&&!identityFailed;$("tryDemo").hidden=false;$("tryDemo").disabled=false;$("cancelEnter").hidden=true;
  render();authNote(message||(globalThis.puter?"Вход через Puter":"Подключаем сервис входа…"),error);
}
function authNote(text,error=false){$("authStatus").textContent=text;$("authStatus").classList.toggle("error",error);}
function openWorkspace(){
  $("welcome").hidden=true;$("workspace").hidden=false;$("mode").hidden=false;render();
  const shortcut=new URLSearchParams(location.search).get("capture");
  if(shortcut==="voice")voice("",false);
  if(shortcut==="expense")editor("expense");
}
function authMessage(e){
  const code=e?.code||e?.error?.code||e?.error;
  if(code==="auth_window_closed")return "Окно входа закрыто. Можно попробовать снова.";
  if(code==="popup_blocked")return "Разреши всплывающие окна для этого сайта и нажми ещё раз.";
  return "Не удалось открыть аккаунт. Проверь интернет и попробуй ещё раз.";
}
async function enter(interactive){
  const sdk=globalThis.puter;
  if(!sdk){authNote("Сервис входа загружается. Если сообщение осталось, обнови страницу.",true);return;}
  if(authBusy||(!interactive&&(!sdk.auth.isSignedIn()||!markerValue())))return;
  authBusy=true;const stamp=++epoch;
  $("enter").disabled=true;$("tryDemo").hidden=true;$("cancelEnter").hidden=false;authNote(interactive?"Заверши вход в окне Puter.":"Открываем твой свод…");
  const hint=setTimeout(()=>{
    if(stamp===epoch&&interactive)authNote("Если окно Puter не появилось, открой Свод в Safari или другом обычном браузере.");
  },6000);
  let session;
  try{
    if(interactive)await sdk.auth.signIn({attempt_temp_user_creation:false,request_auth:true});
    if(stamp!==epoch)return;
    const user=await sdk.auth.getUser();
    if(stamp!==epoch)return;
    if(!interactive&&markerValue()!==user?.uuid)throw Error("session changed");
    session=SvodAccounts.connect(sdk,user);
    const saved=await session.read();
    if(stamp!==epoch){session.close();return;}
    account=session;data=saved;demo=false;mark(user.uuid);openWorkspace();
  }catch(e){
    session?.close();
    if(stamp===epoch)accountScreen(authMessage(e),true);
  }finally{
    clearTimeout(hint);
    if(stamp===epoch){authBusy=false;$("enter").disabled=!globalThis.puter&&!identityFailed;$("tryDemo").hidden=false;$("tryDemo").disabled=false;$("cancelEnter").hidden=true;}
  }
}
$("enter").onclick=()=>identityFailed?location.reload():enter(true);
$("cancelEnter").onclick=()=>accountScreen("Вход отменён.");
$("tryDemo").onclick=()=>{accountScreen();data=sample();demo=true;openWorkspace();};
function signOut(){
  const sdk=globalThis.puter;
  mark(null);accountScreen("Ты вышел из аккаунта.");
  try{sdk?.auth.signOut();}catch{authNote("Свод закрыт на этом устройстве.");}
}
async function syncAccount(){
  if(!account||busy)return;
  const session=account,stamp=epoch,ticket=++readNonce;
  try{
    const saved=await session.read();
    if(stamp===epoch&&ticket===readNonce&&!busy){data=saved;render();}
  }catch(e){
    if(stamp!==epoch||ticket!==readNonce)return;
    try{session.check();}catch{signOut();return;}
    notify("Не удалось обновить записи. Проверь соединение.");
  }
}
$("mode").onclick=()=>{
  if(demo){accountScreen();return;}
  if(!account)return;
  show("Мой аккаунт",'<div class="fields"><p><strong>'+esc(account.user.username)+'</strong></p><p class="quiet">Расходы и задачи сохраняются в твоём аккаунте Puter.</p><label>Быстрый голосовой ввод<input readonly id="shortcutURL"></label><button id="signOut" class="secondary">Выйти из аккаунта</button></div>');
  const url=new URL(location.href);url.search="?capture=voice";url.hash="";$("shortcutURL").value=url.href;$("shortcutURL").onclick=e=>e.target.select();
  $("signOut").onclick=signOut;
};
$("legend").onclick=e=>{const b=e.target.closest("[data-cat]");if(b){category=category===b.dataset.cat?null:b.dataset.cat;render();}};
$("taskList").onclick=async e=>{const t=e.target.closest("[data-toggle]"),b=e.target.closest("[data-task]");if(t){await change(s=>{const row=s.tasks.find(v=>v.id===t.dataset.toggle);if(row)row.done=!data.tasks.find(v=>v.id===row.id).done;});}else if(b){const row=data.tasks.find(v=>v.id===b.dataset.task);if(row)editor("task",row);}};
function calendar(anchor=selected.slice(0,7)){
  const first=anchor+"-01",date=C.local(first),skip=(date.getDay()+6)%7,count=new Date(date.getFullYear(),date.getMonth()+1,0).getDate();
  let days=["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].map(w=>'<span>'+w+'</span>').join("")+'<i></i>'.repeat(skip);
  for(let n=1;n<=count;n++){const iso=anchor+"-"+String(n).padStart(2,"0");days+='<button data-date="'+iso+'" class="'+(iso===selected?'selected ':'')+(iso===C.day()?'today':'')+'">'+n+'</button>';}
  show("Календарь",'<div class="weekhead"><button id="prev" class="iconbtn" aria-label="Предыдущий месяц">'+icon("back")+'</button><strong>'+displayDate(first,{month:"long",year:"numeric"})+'</strong><button id="next" class="iconbtn" aria-label="Следующий месяц">'+icon("chevron")+'</button></div><div class="days" id="days">'+days+'</div><button class="secondary wide footerrow" id="today">Сегодня</button>');
  function pick(iso){selected=iso;month=iso.slice(0,7);category=null;render();close();}
  $("prev").onclick=()=>{date.setMonth(date.getMonth()-1);calendar(C.day(date).slice(0,7));};$("next").onclick=()=>{date.setMonth(date.getMonth()+1);calendar(C.day(date).slice(0,7));};
  $("today").onclick=()=>pick(C.day());$("days").onclick=e=>{if(e.target.dataset.date)pick(e.target.dataset.date);};
}
$("calendar").onclick=()=>calendar();
function history(){
  const list=data.expenses.filter(e=>e.date.startsWith(month)).reverse().sort((a,b)=>b.date.localeCompare(a.date));
  show("История расходов",'<label class="fieldlabel">Месяц<input id="period" type="month" required value="'+month+'"></label><div class="historylist" id="records">'+(list.map(e=>'<button class="historyrow" data-id="'+esc(e.id)+'">'+badge(catBy(e.category))+'<span class="desc">'+esc(e.name)+'<small>'+displayDate(e.date,{day:"numeric",month:"short"})+' · '+catBy(e.category).name+'</small></span><b class="rowprice">'+amount(e.cents)+' AED</b></button>').join("")||'<p class="empty">За этот месяц пока нет расходов.</p>')+'</div><button class="primary wide footerrow" id="historyAdd">Добавить расход</button>');
  $("period").onchange=e=>{if(/^\d{4}-\d{2}$/.test(e.target.value)){month=e.target.value;category=null;render();history();}};
  $("records").onclick=e=>{const b=e.target.closest("[data-id]");if(b)editor("expense",data.expenses.find(x=>x.id===b.dataset.id),true);};
  $("historyAdd").onclick=()=>editor("expense",null,true);
}
$("hero").onclick=history;
const categoryOptions=id=>C.categories.map(c=>'<option value="'+c.id+'" '+(id===c.id?'selected':'')+'>'+c.name+'</option>').join("");
function fields(d){
  const expense=d.type==="expense";
  return '<div class="fields"><label>'+(expense?'На что потратил':'Что нужно сделать')+'<input name="name" maxlength="180" required value="'+esc(d.name)+'" placeholder="'+(expense?'Например, мойка':'Например, позвонить в сервис')+'"></label>'+(expense?'<div class="grid2"><label>Сумма, AED<input type="text" inputmode="decimal" name="price" required placeholder="0,00" value="'+(d.cents==null?'':esc(d.cents/100))+'"></label><label>Категория<select name="category">'+categoryOptions(d.category)+'</select></label></div>':'')+'<label>Дата<input type="date" name="date" min="1900-01-01" max="9999-12-31" required value="'+esc(d.date)+'"></label></div>';
}
function readFields(root,type){
  const name=root.querySelector('[name=name]').value.trim(),date=root.querySelector('[name=date]').value;
  if(!name||!/^\d{4}-\d\d-\d\d$/.test(date))throw Error("Введи название и дату.");
  if(type==="task")return {name,date};
  const raw=root.querySelector('[name=price]').value.trim().replace(/\s/g,"").replace(",",".");
  if(!/^\d{1,9}(?:\.\d{1,2})?$/.test(raw)||Number(raw)<=0)throw Error("Укажи положительную сумму с точностью до двух знаков.");
  return {name,date,cents:Math.round(Number(raw)*100),category:root.querySelector('[name=category]').value};
}
function putRow(rows,entry){
  const old=rows.find(row=>row.id===entry.id);
  if(old)Object.assign(old,entry);else rows.push(entry);
}
function editor(type,record=null,fromHistory=false){
  const expense=type==="expense",list=expense?"expenses":"tasks";
  if(record===undefined)return;
  const entryId=record?.id||newId();
  const defaultDate=fromHistory&&month!==selected.slice(0,7)?month+"-01":selected;
  show(record?(expense?"Редактировать расход":"Редактировать задачу"):(expense?"Добавить расход":"Добавить задачу"),'<form class="fields" id="form">'+fields({type,name:"",category:"other",date:defaultDate,...record})+(demo&&!record?'<p class="quiet">Это демо. Изменения действуют до выхода из него.</p>':'')+errorSlot+'<button class="primary">Сохранить</button>'+(record?'<button type="button" class="danger" id="remove">Удалить</button>':'')+'</form>');
  const f=$("form");
  if(expense&&!record){const name=f.elements.namedItem("name"),cat=f.elements.namedItem("category"),price=f.elements.namedItem("price");let manualCat=false,manualPrice=false;cat.onchange=()=>manualCat=true;price.oninput=()=>manualPrice=true;
    name.onchange=()=>{const past=demo?[]:data.expenses;const prior=[...past].reverse().find(x=>C.key(x.name)===C.key(name.value));if(!manualCat)cat.value=prior?.category||C.categorize(name.value,past);if(!manualPrice)price.value=prior?prior.cents/100:"";};
  }
  f.onsubmit=async e=>{e.preventDefault();let values;try{values=readFields(f,type);}catch(err){report(err.message);return;}
    const ok=await change(s=>{if(record){const row=s[list].find(x=>x.id===record.id);if(!row)throw Error("Запись уже удалена.");Object.assign(row,values);}else{putRow(s[list],{id:entryId,...(expense?{}:{done:false}),...values});}});
    if(ok){if(expense)month=values.date.slice(0,7);else selected=values.date;category=null;render();if(fromHistory)history();else close();notify("Сохранено");}};
  if(record)$("remove").onclick=()=>{show("Удалить запись?",'<p class="quiet">'+esc(record.name)+'</p><div class="toolbar footerrow"><button id="cancelRemove" class="secondary">Отмена</button><button id="confirmRemove" class="danger">Удалить</button></div>'+errorSlot);
    $("cancelRemove").onclick=()=>editor(type,record,fromHistory);$("confirmRemove").onclick=async()=>{if(await change(s=>{s[list]=s[list].filter(x=>x.id!==record.id);})){if(fromHistory)history();else close();notify("Удалено");}};};
}
$("addExpense").onclick=()=>editor("expense");$("addTask").onclick=()=>editor("task");
function review(drafts,source){
  const ids=drafts.map(()=>newId());
  show("Проверить запись",'<p class="quiet">'+esc(source)+'</p><form class="fields" id="review"><div id="drafts"></div>'+errorSlot+'<button class="primary">Сохранить '+(drafts.length>1?'записи':'запись')+'</button><button type="button" id="backVoice" class="secondary">Вернуться к тексту</button></form>');
  drafts.forEach((d,i)=>{
    const section=document.createElement("section");section.className="draft";section.dataset.type=d.type;section.innerHTML='<div class="editorhead"><label class="fieldlabel">Тип записи<select class="draftType"><option value="expense">Расход</option><option value="task">Задача</option></select></label></div><div class="draftFields">'+fields(d)+'</div>';
    const select=section.querySelector(".draftType");select.value=d.type;
    select.onchange=()=>{const val=k=>section.querySelector('[name='+k+']')?.value;
      Object.assign(d,{name:val("name"),date:val("date"),type:select.value});
      if(val("price")){const p=Number(val("price").replace(",","."));if(Number.isFinite(p))d.cents=Math.round(p*100);}
      if(val("category"))d.category=val("category");
      section.dataset.type=d.type;section.querySelector(".draftFields").innerHTML=fields(d);};
    $("drafts").append(section);
  });
  $("backVoice").onclick=()=>voice(source,false);
  $("review").onsubmit=async e=>{e.preventDefault();let rows;try{rows=[...document.querySelectorAll("#drafts .draft")].map(el=>({type:el.dataset.type,...readFields(el,el.dataset.type)}));}catch(err){report(err.message);return;}
    if(await change(s=>{rows.forEach(({type,...entry},i)=>{if(type==="expense")putRow(s.expenses,{id:ids[i],...entry});else putRow(s.tasks,{id:ids[i],done:false,...entry});});})){
      const task=rows.find(x=>x.type==="task"),expense=rows.find(x=>x.type==="expense");
      if(task)selected=task.date;month=(expense?.date||selected).slice(0,7);category=null;render();close();notify(rows.length===1?"Запись сохранена":"Сохранено записей: "+rows.length);}};
}
function voice(source="",auto=true){
  show("Голосовая запись",'<form class="fields" id="capture"><button class="primary voicebar" type="button" id="listen">'+icon("mic")+'<span>Записать</span></button><p id="speechNote" class="quiet" role="status">До одной минуты. Первая расшифровка загрузит модель речи на устройство.</p><div id="clip" hidden><audio id="playback" controls></audio><a id="downloadClip">Скачать запись</a></div><button class="secondary" type="button" id="retrySpeech" hidden>Повторить расшифровку</button><label>Текст записи<textarea required maxlength="1200" id="words" placeholder="Например, заправился на 120 и завтра позвони в сервис">'+esc(source)+'</textarea></label>'+errorSlot+'<button class="primary" id="parseVoice">Разобрать запись</button></form>');
  const words=$("words"),note=$("speechNote"),button=$("listen"),retry=$("retrySpeech");
  let state="idle";
  voiceSession=SvodVoice.session({
    status:msg=>{note.textContent=msg;},
    phase:next=>{
      state=next;
      const working=["requesting","stopping","processing"].includes(next);
      button.disabled=working;
      button.querySelector("span").textContent=next==="recording"?"Стоп":next==="ready"||next==="retry"?"Записать заново":"Записать";
      button.classList.toggle("recording",next==="recording");
      retry.hidden=next!=="retry";
      words.readOnly=working||next==="recording";
      $("parseVoice").disabled=words.readOnly;
    },
    clip:(url,type)=>{$("clip").hidden=false;$("playback").src=url;$("downloadClip").href=url;$("downloadClip").download="Svod-voice."+(type.includes("mp4")?"m4a":"webm");},
    transcript:text=>{words.value=text.slice(0,1200);}
  });
  button.onclick=()=>state==="recording"?voiceSession.stop():voiceSession.start();
  retry.onclick=()=>voiceSession.transcribe();
  if(auto)voiceSession.start();
  $("capture").onsubmit=e=>{e.preventDefault();const msg=words.value.trim();if(!msg){report("Введи текст или запиши фразу.");return;}
    const drafts=C.parse(msg,selected,demo?[]:data.expenses);if(!drafts.length){report("Добавь название расхода или задачи.");return;}review(drafts,msg);};
}
$("voice").onclick=()=>voice();
window.addEventListener("storage",e=>{
  if((e.key===marker||e.key===null)&&(account||authBusy)&&markerValue()!==account?.user.uuid)accountScreen("Аккаунт изменился в другой вкладке. Войди снова.");
});
document.addEventListener("visibilitychange",()=>{if(!document.hidden)syncAccount();});
window.addEventListener("pageshow",e=>{if(e.persisted){accountScreen();enter(false);}});
window.addEventListener("pagehide",()=>{if(account)accountScreen();});
accountScreen();
const sdkTag=$("identitySDK");
function sdkReady(){
  if(!globalThis.puter?.auth){sdkFailed();return;}
  identityFailed=false;
  if(!demo&&!account&&!authBusy){$("enter").disabled=false;$("enter").textContent="Войти или зарегистрироваться";authNote("Вход через Puter");enter(false);}
}
function sdkFailed(){
  identityFailed=true;$("enter").disabled=false;$("enter").textContent="Повторить подключение";
  authNote("Не удалось подключиться к Puter. Проверь интернет.",true);
}
if(globalThis.puter?.auth)sdkReady();
else {
  sdkTag.addEventListener("load",sdkReady);
  sdkTag.addEventListener("error",sdkFailed);
  setTimeout(()=>{if(!globalThis.puter?.auth)sdkFailed();},15000);
}
