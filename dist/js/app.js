/* beres. - logika app. Nol dependency, nol global selain BeresParse.
 * Timer fokus pakai deadline timestamp (bukan counter--), lihat catatan di focusRemain().
 */
'use strict';
(function () {

var P = window.BeresParse;
var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };

var KEY = 'beres.v1';
var SWIPE = 84;
var PAL = ['#C6F24E','#6BA9FF','#FF6B35','#B79CFF','#4FD9C4','#FF7BB8','#FFA53D','#8BD450'];

var ICO = {
  check:'<svg viewBox="0 0 24 24"><path d="M4.5 12.5l5 5 10-10"/></svg>',
  cal:'<svg viewBox="0 0 24 24"><path d="M4 5.5h16v15H4zM4 10h16M9 3v4M15 3v4"/></svg>',
  clock:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  rep:'<svg viewBox="0 0 24 24"><path d="M4 9a7 7 0 0111.9-3.6L20 9M20 15a7 7 0 01-11.9 3.6L4 15M20 4.5V9h-4.5M4 19.5V15h4.5"/></svg>',
  sub:'<svg viewBox="0 0 24 24"><path d="M5 6h14M5 12h9M5 18h5"/></svg>',
  flag:'<svg viewBox="0 0 24 24"><path d="M6 21V4h12l-2.5 4.5L18 13H6"/></svg>',
  play:'<svg viewBox="0 0 24 24"><path d="M9 6.5l9 5.5-9 5.5z"/></svg>',
  grip:'<svg viewBox="0 0 24 24"><path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01"/></svg>',
  trash:'<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V5h4v2M6.5 7l1 13h9l1-13"/></svg>',
  find:'<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M15.8 15.8L20.5 20.5"/></svg>'
};

/* teks acak: bikin app terasa hidup dipakai berhari-hari */
var TXT = {
  clearToday:['Kelar semua. Santai dulu.','Nol sisa hari ini. Mantap.','Bersih. Nggak ada PR.','Beres semua. Gas rebahan.'],
  emptyToday:['Hari ini kosong','Belum ada yang dijadwalin','Lowong nih hari ini'],
  subToday:['Tulis satu aja dulu, nggak usah banyak.','Mulai dari yang paling gampang.','Satu tugas kecil juga ngitung.'],
  done:['Sip','Mantap','Gas terus','Kelar satu','Nice'],
  focusIdle:['Pilih satu tugas, kerjain sampai kelar.','Satu tugas dulu. Jangan multitasking.','Taruh HP. Satu sesi aja.'],
  focusRest:['Rehat bentar. Jangan buka medsos.','Berdiri, minum, lihat jauh.','Istirahat beneran ya, bukan scroll.']
};
function pick(a){ return a[Math.floor(Math.random()*a.length)]; }

/* ================= state ================= */
var S, view={type:'today',id:null}, q='', undo=null, undoTimer=null, editing=null, dragId=null;

function blank(){
  return {
    tasks:[], projects:[{id:'p-umum',name:'Umum',color:PAL[0]}],
    sessions:[],            // {d:'2026-08-01',min:25}
    set:{theme:'dark',accent:'lime',fx:true,hideDone:false,notify:false,sort:'manual',focusMin:25},
    seq:0
  };
}
var BAK=KEY+'-bak';
function cleanTask(t){
  if(!t||typeof t!=='object'||typeof t.title!=='string'||!t.title.trim()) return null;
  return {
    id:typeof t.id==='string'?t.id:'t-'+uid(),
    title:t.title.slice(0,300),
    note:typeof t.note==='string'?t.note:'',
    due:typeof t.due==='string'&&P.parseISO(t.due)?t.due:null,
    time:/^\d{2}:\d{2}$/.test(t.time||'')?t.time:null,
    priority:+t.priority>=1&&+t.priority<=4?+t.priority:0,
    project:typeof t.project==='string'?t.project:null,
    labels:(Array.isArray(t.labels)?t.labels:[])
      .filter(function(l){ return typeof l==='string'; }).slice(0,20),
    repeat:t.repeat&&typeof t.repeat==='object'&&t.repeat.unit?t.repeat:null,
    subs:(Array.isArray(t.subs)?t.subs:[])
      .filter(function(s){ return s&&typeof s.t==='string'; })
      .map(function(s){ return {t:s.t.slice(0,300),done:!!s.done}; }),
    done:!!t.done, doneAt:+t.doneAt||null,
    created:+t.created||Date.now(), ord:+t.ord||0
  };
}
// JSON valid belum berarti berbentuk state. '"teks"', '12345', '[1,2]' semua
// lolos JSON.parse; kalau diteruskan, S.tasks jadi undefined dan app blank
// total (user kehilangan akses ke semua tugasnya). Tolak yang bukan objek,
// dan saring entri tugas yang rusak. Dipakai juga saat impor file.
function norm(d){
  if(typeof d!=='object'||d===null||Array.isArray(d)) return null;
  var b=blank();
  d.tasks=(Array.isArray(d.tasks)?d.tasks:[]).map(cleanTask).filter(Boolean);
  d.projects=(Array.isArray(d.projects)?d.projects:[])
    .filter(function(p){ return p&&typeof p.id==='string'&&typeof p.name==='string'; });
  if(!d.projects.length) d.projects=b.projects;
  d.sessions=(Array.isArray(d.sessions)?d.sessions:[])
    .filter(function(s){ return s&&typeof s.d==='string'; });
  d.set=Object.assign(b.set,d.set||{});
  d.seq=+d.seq||0;
  return d;
}
function load(){
  var raw=localStorage.getItem(KEY), d=null;
  if(raw) try{ d=norm(JSON.parse(raw)); }catch(e){}
  if(d) return d;
  /* state utama korup atau hilang: coba cadangan rolling */
  try{
    var bak=localStorage.getItem(BAK);
    if(bak){ d=norm(JSON.parse(bak)); if(d) return d; }
  }catch(e){}
  return blank();
}
var saveT=null, saveWarned=false;
function trySave(){
  var str=JSON.stringify(S);
  try{
    localStorage.setItem(KEY,str);
    saveWarned=false;
  }catch(e){
    if(!saveWarned){ saveWarned=true; toast('Penyimpanan penuh, cadangkan lalu hapus yang lama'); }
  }
  try{ localStorage.setItem(BAK,str); }catch(e){}
}
function save(){
  clearTimeout(saveT);
  saveT=setTimeout(trySave,120);
}
function saveNow(){ clearTimeout(saveT); trySave(); }

/* ================= util ================= */
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
function today(){ return P.ymd(new Date()); }
function byId(id){ for(var i=0;i<S.tasks.length;i++) if(S.tasks[i].id===id) return S.tasks[i]; return null; }
function proj(id){ for(var i=0;i<S.projects.length;i++) if(S.projects[i].id===id) return S.projects[i]; return null; }
var EM={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return EM[c];}); }
function hm(d){ return (d.getHours()<10?'0':'')+d.getHours()+':'+(d.getMinutes()<10?'0':'')+d.getMinutes(); }
function nowHM(){ return hm(new Date()); }

/* ================= toast + undo ================= */
var elToast=$('#toast'), elToastMsg=$('#toastMsg'), elToastAct=$('#toastAct');
function toast(msg,undoFn){
  clearTimeout(undoTimer);
  elToastMsg.textContent=msg;
  undo=undoFn||null;
  elToastAct.hidden=!undoFn;
  elToast.hidden=false; elToast.classList.remove('out');
  undoTimer=setTimeout(hideToast,undoFn?5200:2400);
}
function hideToast(){
  if(elToast.hidden) return;
  elToast.classList.add('out');
  setTimeout(function(){ elToast.hidden=true; elToast.classList.remove('out'); },170);
  undo=null;
}
elToastAct.addEventListener('click',function(){ if(undo){ var f=undo; undo=null; hideToast(); f(); } });

function buzz(ms){ if(S.set.fx&&navigator.vibrate) try{navigator.vibrate(ms);}catch(e){} }
var actx=null;
function ding(){
  if(!S.set.fx) return;
  try{
    actx=actx||new (window.AudioContext||window.webkitAudioContext)();
    if(actx.state==='suspended') actx.resume();
    var t=actx.currentTime, o=actx.createOscillator(), g=actx.createGain();
    o.type='sine'; o.frequency.setValueAtTime(660,t);
    o.frequency.exponentialRampToValueAtTime(990,t+.09);
    g.gain.setValueAtTime(.0001,t);
    g.gain.exponentialRampToValueAtTime(.13,t+.012);
    g.gain.exponentialRampToValueAtTime(.0001,t+.28);
    o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t+.3);
  }catch(e){}
}
function sparks(x,y){
  if(!S.set.fx) return;
  if(matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  var c=getComputedStyle(document.documentElement).getPropertyValue('--a').trim()||'#C6F24E';
  for(var i=0;i<9;i++){
    (function(i){
      var s=document.createElement('i');
      s.className='spark'; s.style.background=c;
      s.style.left=x+'px'; s.style.top=y+'px';
      document.body.appendChild(s);
      var a=(-140+Math.random()*260)*Math.PI/180, d=26+Math.random()*44;
      s.animate([{transform:'translate(0,0) scale(1)',opacity:1},
        {transform:'translate('+Math.cos(a)*d+'px,'+(Math.sin(a)*d+22)+'px) scale(.2)',opacity:0}],
        {duration:480+Math.random()*260,easing:'cubic-bezier(.22,1,.36,1)'})
        .onfinish=function(){ s.remove(); };
    })(i);
  }
}

/* ================= CRUD ================= */
function addTask(text,opt){
  opt=opt||{};
  var r=P.parse(text);
  if(!r.title && !opt.allowEmpty) return null;
  var pid=opt.project||null;
  if(r.project){
    var f=null;
    for(var i=0;i<S.projects.length;i++)
      if(S.projects[i].name.toLowerCase()===r.project.toLowerCase()) f=S.projects[i];
    if(!f){ f={id:'p-'+uid(),name:r.project,color:PAL[S.projects.length%PAL.length]}; S.projects.push(f); }
    pid=f.id;
  }
  var t={
    id:'t-'+uid(), title:r.title||text.trim(), note:'',
    due:r.due||opt.due||null, time:r.time||null, priority:r.priority||0,
    project:pid, labels:r.labels||[], repeat:r.repeat||null,
    subs:[], done:false, doneAt:null, created:Date.now(), ord:S.seq++
  };
  S.tasks.unshift(t); save();
  return t;
}
function toggle(id,ev){
  var t=byId(id); if(!t) return;
  if(t.done){ t.done=false; t.doneAt=null; save(); render(); return; }

  if(t.repeat){
    var nx=P.nextDue(t.repeat,t.due||today());
    S.sessions=S.sessions; // no-op, jaga bentuk
    var clone={id:'t-'+uid(),title:t.title,note:t.note,due:t.due,time:t.time,
      priority:t.priority,project:t.project,labels:t.labels.slice(),repeat:null,
      subs:[],done:true,doneAt:Date.now(),created:Date.now(),ord:S.seq++};
    S.tasks.push(clone);
    t.due=nx;
    t.subs.forEach(function(s){ s.done=false; });
    save(); afterDone(ev,'Lanjut '+P.fmtDue(nx,t.time)); render(); return;
  }
  t.done=true; t.doneAt=Date.now();
  var prev={due:t.due};
  save(); afterDone(ev,pick(TXT.done),function(){
    t.done=false; t.doneAt=null; t.due=prev.due; save(); render();
  });
  render();
}
function afterDone(ev,msg,undoFn){
  buzz(14); ding();
  if(ev&&ev.clientX) sparks(ev.clientX,ev.clientY);
  toast(msg,undoFn);
}
function removeTask(id){
  var i=S.tasks.map(function(t){return t.id;}).indexOf(id);
  if(i<0) return;
  var t=S.tasks[i];
  S.tasks.splice(i,1); save(); render();
  toast('Dihapus',function(){ S.tasks.splice(i,0,t); save(); render(); });
}

/* ================= filter + urut ================= */
function visible(){
  var out=S.tasks.slice(), td=today();
  if(q){
    var k=q.toLowerCase();
    out=out.filter(function(t){
      var p=proj(t.project);
      return t.title.toLowerCase().indexOf(k)>=0
        || (t.note||'').toLowerCase().indexOf(k)>=0
        || (t.labels||[]).join(' ').toLowerCase().indexOf(k)>=0
        || (p&&p.name.toLowerCase().indexOf(k)>=0);
    });
    return sortList(out);
  }
  switch(view.type){
    case 'today':
      out=out.filter(function(t){ return t.due&&t.due<=td&&(!t.done||!S.set.hideDone); }); break;
    case 'upcoming':
      out=out.filter(function(t){ return t.due&&t.due>td&&!t.done; }); break;
    case 'inbox':
      out=out.filter(function(t){ return !t.due&&!t.done; }); break;
    case 'all':
      out=out.filter(function(t){ return !t.done; }); break;
    case 'done':
      out=out.filter(function(t){ return t.done; })
        .sort(function(a,b){ return (b.doneAt||0)-(a.doneAt||0); });
      return out;
    case 'project':
      out=out.filter(function(t){ return t.project===view.id&&(!t.done||!S.set.hideDone); }); break;
    case 'label':
      out=out.filter(function(t){ return (t.labels||[]).indexOf(view.id)>=0&&!t.done; }); break;
  }
  return sortList(out);
}
function sortList(a){
  var s=S.set.sort;
  return a.sort(function(x,y){
    if(x.done!==y.done) return x.done?1:-1;
    if(s==='priority'){
      var px=x.priority||9, py=y.priority||9;
      if(px!==py) return px-py;
    }
    if(s==='alpha') return x.title.localeCompare(y.title,'id');
    if(s==='due'||s==='priority'){
      if(x.due&&y.due&&x.due!==y.due) return x.due<y.due?-1:1;
      if(x.due&&!y.due) return -1;
      if(!x.due&&y.due) return 1;
    }
    return x.ord-y.ord;
  });
}
function groupsOf(list){
  var td=today(), g=[];
  function push(name,arr,cls){ if(arr.length) g.push({name:name,items:arr,cls:cls||''}); }
  if(q||view.type==='done'||S.set.sort!=='manual'&&view.type!=='today'&&view.type!=='upcoming'){
    push('',list); return g;
  }
  if(view.type==='today'){
    push('Kelewat',list.filter(function(t){return !t.done&&t.due<td;}),'grp--late');
    push('Hari ini',list.filter(function(t){return !t.done&&t.due===td;}));
    push('Sudah kelar',list.filter(function(t){return t.done;}));
    return g;
  }
  if(view.type==='upcoming'){
    var byDay={},order=[];
    list.forEach(function(t){
      if(!byDay[t.due]){ byDay[t.due]=[]; order.push(t.due); }
      byDay[t.due].push(t);
    });
    order.sort();
    order.forEach(function(d){ push(P.fmtPanjang(d),byDay[d]); });
    return g;
  }
  push('',list); return g;
}

/* ================= render ================= */
var elList=$('#list'), elKosong=$('#kosong');

function render(){
  renderNav();
  var list=visible(), gs=groupsOf(list), html='';
  gs.forEach(function(g){
    if(g.name) html+='<div class="grp '+g.cls+'"><h2>'+esc(g.name)+'</h2><i></i><b>'+g.items.length+'</b></div>';
    g.items.forEach(function(t){ html+=cardHTML(t); });
  });
  elList.innerHTML=html;
  elKosong.hidden=list.length>0;
  if(!list.length) renderKosong();
  renderHead(list);
}
function renderHead(list){
  var T={today:'Hari ini',upcoming:'Nanti',inbox:'Kotak masuk',all:'Semua',done:'Kelar'};
  var title=T[view.type]||'', sub='';
  if(view.type==='project'){ var p=proj(view.id); title=p?p.name:'Proyek'; }
  if(view.type==='label') title='@'+view.id;
  if(q){ title='Cari'; sub=list.length+' hasil untuk "'+q+'"'; }
  else if(view.type==='today'){
    var d=new Date();
    sub=P.WD_NAMA[d.getDay()]+', '+d.getDate()+' '+P.MON_PENDEK[d.getMonth()];
    var sisa=list.filter(function(t){return !t.done;}).length;
    sub+=sisa?' · '+sisa+' belum kelar':' · semua kelar';
  }
  else if(list.length) sub=list.length+' tugas';
  $('#viewTitle').textContent=title;
  $('#viewSub').textContent=sub;
}
function renderKosong(){
  var h='',m=ICO.check,t,p;
  if(q){ m=ICO.find; t='Nggak ketemu'; p='Coba kata lain, atau bikin tugas baru.'; }
  else if(view.type==='today'){
    var adaHariIni=S.tasks.some(function(x){return !x.done;});
    t=adaHariIni?pick(TXT.clearToday):pick(TXT.emptyToday);
    p=pick(TXT.subToday);
  }
  else if(view.type==='upcoming'){ t='Belum ada jadwal'; p='Tugas dengan tenggat di masa depan muncul di sini.'; }
  else if(view.type==='inbox'){ t='Kotak masuk bersih'; p='Tugas tanpa tenggat nongkrong di sini.'; }
  else if(view.type==='done'){ t='Belum ada yang kelar'; p='Centang satu tugas, nanti kelihatan di sini.'; }
  else { t='Kosong'; p='Tambah tugas pakai tombol di bawah.'; }
  h='<div class="kosong__m">'+m+'</div><h2>'+esc(t)+'</h2><p>'+esc(p)+'</p>';
  elKosong.innerHTML=h;
}
function cardHTML(t){
  var td=today(), m='';
  if(t.due){
    var cls=t.due<td?'m--late':(t.due===td?'m--now':'');
    m+='<span class="m '+cls+'">'+ICO.cal+P.fmtDue(t.due,t.time)+'</span>';
  }
  if(t.repeat) m+='<span class="m m--rep">'+ICO.rep+esc(P.repeatLabel(t.repeat))+'</span>';
  var p=proj(t.project);
  if(p) m+='<span class="m m--proj"><i class="dab" style="background:'+esc(p.color)+'"></i>'+esc(p.name)+'</span>';
  if(t.subs&&t.subs.length){
    var dn=t.subs.filter(function(s){return s.done;}).length;
    m+='<span class="m">'+ICO.sub+dn+'/'+t.subs.length+'</span>';
  }
  (t.labels||[]).forEach(function(l){ m+='<span class="m m--lbl">'+esc(l)+'</span>'; });

  var prog='';
  if(t.subs&&t.subs.length){
    var pc=Math.round(t.subs.filter(function(s){return s.done;}).length/t.subs.length*100);
    prog='<div class="bar-sub"><i style="width:'+pc+'%"></i></div>';
  }
  return '<div class="row-wrap" data-id="'+t.id+'">'+
    '<div class="row-bg"><div class="ok">'+ICO.check+'<span>Kelar</span></div>'+
    '<div class="no"><span>Hapus</span>'+ICO.trash+'</div></div>'+
    '<article class="task'+(t.done?' done':'')+'" data-p="'+(t.priority||0)+'" data-id="'+t.id+'">'+
      '<button class="cb" type="button" data-act="cb" aria-label="Tandai kelar" aria-pressed="'+(t.done?'true':'false')+'">'+ICO.check+'</button>'+
      '<div class="task__mid" data-act="open">'+
        '<div class="task__t">'+esc(t.title)+'</div>'+
        (t.note?'<div class="task__n">'+esc(t.note)+'</div>':'')+
        (m?'<div class="meta">'+m+'</div>':'')+prog+
      '</div>'+
      '<div class="task__r">'+
        '<button class="mini" type="button" data-act="focus" aria-label="Fokus di tugas ini">'+ICO.play+'</button>'+
        '<button class="mini grip" type="button" data-act="grip" aria-label="Geser urutan" draggable="true">'+ICO.grip+'</button>'+
      '</div>'+
    '</article></div>';
}
function renderNav(){
  var td=today();
  var c={
    today:S.tasks.filter(function(t){return !t.done&&t.due&&t.due<=td;}).length,
    upcoming:S.tasks.filter(function(t){return !t.done&&t.due&&t.due>td;}).length,
    inbox:S.tasks.filter(function(t){return !t.done&&!t.due;}).length,
    all:S.tasks.filter(function(t){return !t.done;}).length,
    done:S.tasks.filter(function(t){return t.done;}).length
  };
  $$('[data-count]').forEach(function(b){
    var n=c[b.getAttribute('data-count')];
    b.textContent=n?n:'';
  });
  $$('#navView .nav__i').forEach(function(b){
    b.classList.toggle('on',!q&&view.type===b.getAttribute('data-view'));
  });
  $$('.tabs__i[data-view]').forEach(function(b){
    b.classList.toggle('on',!q&&view.type===b.getAttribute('data-view'));
  });

  var ph='';
  S.projects.forEach(function(p){
    var n=S.tasks.filter(function(t){return t.project===p.id&&!t.done;}).length;
    ph+='<button class="nav__i'+(view.type==='project'&&view.id===p.id?' on':'')+
      '" type="button" data-project="'+esc(p.id)+'">'+
      '<i class="dab" style="background:'+esc(p.color)+'"></i>'+
      '<span>'+esc(p.name)+'</span><b>'+(n||'')+'</b></button>';
  });
  $('#navProject').innerHTML=ph;

  var L={};
  S.tasks.forEach(function(t){ if(!t.done)(t.labels||[]).forEach(function(l){ L[l]=(L[l]||0)+1; }); });
  var keys=Object.keys(L).sort();
  $('#secLabel').hidden=!keys.length;
  $('#navLabel').innerHTML=keys.map(function(l){
    return '<button class="tag'+(view.type==='label'&&view.id===l?' on':'')+
      '" type="button" data-label="'+esc(l)+'">'+esc(l)+'</button>';
  }).join('');
}
function go(type,id){
  view={type:type,id:id||null};
  q=''; $('#findInput').value=''; $('#findRow').hidden=true;
  closeRak(); render();
  window.scrollTo({top:0,behavior:'smooth'});
}

/* ================= token pratinjau ================= */
function tokenHTML(r){
  var ic={date:ICO.cal,time:ICO.clock,repeat:ICO.rep,priority:ICO.flag,project:'',label:''};
  return (r.tokens||[]).map(function(t){
    return '<span class="tk tk--'+t.type+'">'+(ic[t.type]||'')+esc(t.label)+'</span>';
  }).join('');
}
var elQuick=$('#quickForm'), elQI=$('#quickInput'), elQT=$('#quickTokens');
elQI.addEventListener('input',function(){
  elQuick.classList.toggle('hot',!!elQI.value.trim());
  elQT.innerHTML=elQI.value.trim()?tokenHTML(P.parse(elQI.value)):'';
});
elQuick.addEventListener('submit',function(e){
  e.preventDefault();
  var v=elQI.value.trim(); if(!v) return;
  var opt={};
  if(view.type==='project') opt.project=view.id;
  if(view.type==='today') opt.due=today();
  var t=addTask(v,opt);
  if(!t) return;
  elQI.value=''; elQT.innerHTML=''; elQuick.classList.remove('hot');
  render(); buzz(8);
});

/* ================= sheet ================= */
var openSheets=[];
function openSheet(el){
  $('#scrim').hidden=false;
  el.hidden=false; el.classList.remove('out');
  openSheets.push(el);
  document.body.style.overflow='hidden';
}
function closeSheet(el){
  el=el||openSheets[openSheets.length-1];
  if(!el) return;
  el.classList.add('out');
  setTimeout(function(){
    el.hidden=true; el.classList.remove('out');
    openSheets=openSheets.filter(function(x){return x!==el;});
    if(!openSheets.length){ $('#scrim').hidden=true; document.body.style.overflow=''; }
  },190);
}
$('#scrim').addEventListener('click',function(){ closeSheet(); });
document.addEventListener('click',function(e){
  var c=e.target.closest('[data-close]');
  if(c) closeSheet(c.closest('.sheet'));
});

/* ---- sheet tugas ---- */
var draft=null;
function openTask(id){
  var t=id?byId(id):null;
  editing=id||null;
  draft=t?JSON.parse(JSON.stringify(t)):{
    id:null,title:'',note:'',due:view.type==='today'?today():null,time:null,priority:0,
    project:view.type==='project'?view.id:null,labels:[],repeat:null,subs:[],done:false
  };
  $('#taskTitle').textContent=t?'Ubah tugas':'Tugas baru';
  $('#tDelete').hidden=!t;
  $('#tTitle').value=draft.title;
  $('#tNote').value=draft.note||'';
  $('#tDate').value=draft.due||'';
  $('#tTime').value=draft.time||'';
  $('#tLabels').value=(draft.labels||[]).join(', ');
  $('#tRepeat').value=draft.repeat?repToVal(draft.repeat):'';
  $$('#tPrio button').forEach(function(b){
    b.classList.toggle('on',+b.getAttribute('data-p')===(draft.priority||0));
  });
  var ph='';
  S.projects.forEach(function(p){
    ph+='<option value="'+esc(p.id)+'"'+(draft.project===p.id?' selected':'')+'>'+esc(p.name)+'</option>';
  });
  $('#tProject').innerHTML='<option value="">Tanpa proyek</option>'+ph;
  $('#tTokens').innerHTML='';
  renderSubs();
  openSheet($('#sheetTask'));
  if(!t) setTimeout(function(){ $('#tTitle').focus(); },260);
}
function repToVal(r){
  if(!r) return '';
  if(r.wd&&r.wd.length) return 'wd:'+r.wd.join(',');
  return r.unit+':'+(r.interval||1);
}
function valToRep(v){
  if(!v) return null;
  var a=v.split(':');
  if(a[0]==='wd') return {unit:'week',interval:1,wd:a[1].split(',').map(Number)};
  return {unit:a[0],interval:+a[1]||1,wd:null};
}
function renderSubs(){
  var h='';
  (draft.subs||[]).forEach(function(s,i){
    h+='<div class="sub'+(s.done?' done':'')+'" data-i="'+i+'">'+
      '<button class="cb" type="button" data-sub="'+i+'" aria-label="Tandai langkah">'+ICO.check+'</button>'+
      '<span>'+esc(s.t)+'</span>'+
      '<button class="iconbtn iconbtn--s" type="button" data-subdel="'+i+'" aria-label="Hapus langkah">'+
      '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>';
  });
  $('#tSubs').innerHTML=h;
  var n=(draft.subs||[]).length;
  $('#subCount').textContent=n?'('+draft.subs.filter(function(s){return s.done;}).length+'/'+n+')':'';
}
$('#tTitle').addEventListener('input',function(){
  var v=this.value.trim();
  if(!v){ $('#tTokens').innerHTML=''; return; }
  var r=P.parse(v);
  $('#tTokens').innerHTML=tokenHTML(r);
});
$('#tSubs').addEventListener('click',function(e){
  var b=e.target.closest('[data-sub]');
  if(b){ var i=+b.getAttribute('data-sub'); draft.subs[i].done=!draft.subs[i].done; renderSubs(); return; }
  var d=e.target.closest('[data-subdel]');
  if(d){ draft.subs.splice(+d.getAttribute('data-subdel'),1); renderSubs(); }
});
$('#subForm').addEventListener('submit',function(e){
  e.preventDefault();
  var v=$('#subInput').value.trim(); if(!v) return;
  draft.subs=draft.subs||[]; draft.subs.push({t:v,done:false});
  $('#subInput').value=''; renderSubs();
});
$('#tPrio').addEventListener('click',function(e){
  var b=e.target.closest('button'); if(!b) return;
  draft.priority=+b.getAttribute('data-p');
  $$('#tPrio button').forEach(function(x){ x.classList.toggle('on',x===b); });
});
$('#tQuickDay').addEventListener('click',function(e){
  var b=e.target.closest('button'); if(!b) return;
  var v=b.getAttribute('data-day');
  $('#tDate').value = v==='x' ? '' : P.ymd(P.addDays(new Date(),+v));
});
$('#tSave').addEventListener('click',function(){
  var raw=$('#tTitle').value.trim();
  if(!raw){ $('#tTitle').focus(); return; }
  var r=P.parse(raw);
  var t=editing?byId(editing):null;
  var isNew=!t;
  if(!t){ t={id:'t-'+uid(),created:Date.now(),ord:S.seq++,done:false,doneAt:null}; }
  t.title=r.title||raw;
  t.note=$('#tNote').value.trim();
  // isian manual menang atas hasil parse
  t.due=$('#tDate').value||r.due||null;
  t.time=$('#tTime').value||r.time||null;
  t.priority=draft.priority||r.priority||0;
  t.project=$('#tProject').value||null;
  var lb=$('#tLabels').value.split(',').map(function(s){return s.trim();}).filter(Boolean);
  t.labels=lb.length?lb:(r.labels||[]);
  t.repeat=valToRep($('#tRepeat').value)||r.repeat||null;
  t.subs=draft.subs||[];
  if(isNew) S.tasks.unshift(t);
  save(); closeSheet($('#sheetTask')); render();
  toast(isNew?'Tugas ditambah':'Disimpan');
});
$('#tDelete').addEventListener('click',function(){
  var id=editing; closeSheet($('#sheetTask'));
  setTimeout(function(){ removeTask(id); },200);
});

/* ================= interaksi daftar ================= */
elList.addEventListener('click',function(e){
  var w=e.target.closest('.row-wrap'); if(!w) return;
  var id=w.getAttribute('data-id');
  var act=e.target.closest('[data-act]');
  if(!act) return;
  var a=act.getAttribute('data-act');
  if(a==='cb'){ toggle(id,e); return; }
  if(a==='open'){ openTask(id); return; }
  if(a==='focus'){ focusOn(id); return; }
});

/* swipe: kanan = kelar, kiri = hapus */
(function(){
  var sx=0,sy=0,dx=0,active=null,card=null,lock=null;
  elList.addEventListener('touchstart',function(e){
    if(e.touches.length!==1) return;
    var w=e.target.closest('.row-wrap'); if(!w) return;
    active=w; card=$('.task',w); sx=e.touches[0].clientX; sy=e.touches[0].clientY; dx=0; lock=null;
  },{passive:true});
  elList.addEventListener('touchmove',function(e){
    if(!active) return;
    var x=e.touches[0].clientX-sx, y=e.touches[0].clientY-sy;
    if(lock===null){
      if(Math.abs(x)<6&&Math.abs(y)<6) return;
      lock=Math.abs(x)>Math.abs(y)?'x':'y';
    }
    if(lock!=='x'){ active=null; return; }
    dx=x; card.style.transform='translateX('+dx+'px)';
    card.style.transition='none';
  },{passive:true});
  elList.addEventListener('touchend',function(){
    if(!active||!card) { active=null; return; }
    var id=active.getAttribute('data-id');
    card.style.transition='';
    if(dx>SWIPE){ card.style.transform=''; toggle(id); }
    else if(dx<-SWIPE){ card.style.transform=''; removeTask(id); }
    else card.style.transform='';
    active=null; card=null; dx=0;
  });
})();

/* drag reorder (desktop) */
elList.addEventListener('dragstart',function(e){
  var g=e.target.closest('[data-act="grip"]'); if(!g){ e.preventDefault(); return; }
  var t=g.closest('.task'); dragId=t.getAttribute('data-id');
  t.classList.add('drag');
  e.dataTransfer.effectAllowed='move';
  try{ e.dataTransfer.setData('text/plain',dragId); }catch(err){}
});
elList.addEventListener('dragend',function(){
  dragId=null;
  $$('.task').forEach(function(x){ x.classList.remove('drag','over'); });
});
elList.addEventListener('dragover',function(e){
  if(!dragId) return;
  e.preventDefault();
  var t=e.target.closest('.task'); if(!t) return;
  $$('.task').forEach(function(x){ x.classList.remove('over'); });
  if(t.getAttribute('data-id')!==dragId) t.classList.add('over');
});
elList.addEventListener('drop',function(e){
  if(!dragId) return;
  e.preventDefault();
  var t=e.target.closest('.task'); if(!t) return;
  var overId=t.getAttribute('data-id');
  if(overId===dragId) return;
  var a=byId(dragId), b=byId(overId);
  if(!a||!b) return;
  var o=b.ord;
  S.tasks.forEach(function(x){ if(x.ord>=o&&x!==a) x.ord++; });
  a.ord=o;
  S.set.sort='manual';
  save(); render();
});

/* ================= FOKUS =================
 * Deadline timestamp, BUKAN counter yang dikurangi tiap detik.
 * Alasan: setInterval tidak pernah tepat 1000ms (drift menumpuk), dan tab background
 * di-throttle jadi ~1x/menit sehingga sesi 25 menit bisa jadi 40 menit nyata.
 */
var F={running:false,endAt:0,remain:0,phase:'work',taskId:null,raf:0,lastSec:-1};
function focusMs(){ return (S.set.focusMin||25)*60000; }
function restMs(){ return 5*60000; }
function focusRemain(){
  if(!F.running) return F.remain;
  return Math.max(0,F.endAt-Date.now());
}
function focusOn(id){
  F.taskId=id||null;
  if(!F.running){ F.phase='work'; F.remain=focusMs(); }
  paintFocus(true);
  openSheet($('#sheetFocus'));
}
function focusStart(){
  if(F.running) return;
  F.endAt=Date.now()+F.remain; F.running=true;
  try{ if(actx&&actx.state==='suspended') actx.resume(); }catch(e){}
  loop(); $('#focusToggle').textContent='Jeda';
}
function focusPause(){
  if(!F.running) return;
  F.remain=focusRemain(); F.running=false;
  cancelAnimationFrame(F.raf); $('#focusToggle').textContent='Lanjut';
  paintFocus(true);
}
function focusReset(){
  F.running=false; cancelAnimationFrame(F.raf);
  F.remain=F.phase==='work'?focusMs():restMs();
  $('#focusToggle').textContent='Mulai'; paintFocus(true);
}
function focusDone(){
  F.running=false; cancelAnimationFrame(F.raf);
  buzz([18,70,18]); ding();
  if(F.phase==='work'){
    S.sessions.push({d:today(),min:S.set.focusMin||25});
    save();
    F.phase='rest'; F.remain=restMs();
    $('#focusPhase').textContent='rehat';
    document.documentElement.setAttribute('data-phase','rest');
    toast('Sesi kelar. '+pick(TXT.focusRest));
    notify('Sesi fokus kelar','Rehat 5 menit dulu.');
  }else{
    F.phase='work'; F.remain=focusMs();
    $('#focusPhase').textContent='kerja';
    document.documentElement.setAttribute('data-phase','work');
    toast('Rehat kelar. Gas lagi.');
    notify('Rehat kelar','Balik fokus yuk.');
  }
  $('#focusToggle').textContent='Mulai';
  paintFocus(true); renderFocusMeta();
}
function loop(){
  var ms=focusRemain();
  if(ms<=0){ focusDone(); return; }
  paintFocus(false);
  F.raf=requestAnimationFrame(loop);
}
/* jaring pengaman: rAF berhenti total saat tab background */
setInterval(function(){ if(F.running&&focusRemain()<=0) focusDone(); },1000);
document.addEventListener('visibilitychange',function(){
  if(document.visibilityState!=='visible'||!F.running) return;
  if(focusRemain()<=0) focusDone();
  else { F.lastSec=-1; cancelAnimationFrame(F.raf); F.raf=requestAnimationFrame(loop); }
});
function paintFocus(force){
  var ms=focusRemain(), s=Math.ceil(ms/1000);
  if(!force&&s===F.lastSec) return;
  F.lastSec=s;
  var mm=Math.floor(s/60), ss=s%60;
  var str=(mm<10?'0':'')+mm+':'+(ss<10?'0':'')+ss;
  /* slot digit dibangun ulang kalau jumlahnya berubah (60m butuh slot beda dari 5m) */
  var el=$('#clock'), chars=str.split('');
  if(el.children.length!==chars.length){
    el.innerHTML=chars.map(function(c){
      return c===':'?'<span class="clock__sep">:</span>':'<span class="clock__d">'+c+'</span>';
    }).join('');
  }else{
    [].forEach.call(el.children,function(n,i){
      if(n.textContent===chars[i]) return;
      n.textContent=chars[i];
      n.classList.remove('tick'); void n.offsetWidth; n.classList.add('tick');
    });
  }
  $('#clockSr').textContent=mm+' menit '+ss+' detik';
  var total=F.phase==='work'?focusMs():restMs();
  var frac=total?ms/total:0;
  var ticks=$('#ticks').children, n=ticks.length;
  var on=Math.ceil(frac*n);
  for(var i=0;i<n;i++) ticks[i].classList.toggle('on',i<on);
  var t=F.taskId?byId(F.taskId):null;
  $('#focusTask').textContent=t?t.title:pick(TXT.focusIdle);
}
function renderFocusMeta(){
  var td=today();
  var s=S.sessions.filter(function(x){return x.d===td;});
  $('#focusDone').textContent=s.length;
  $('#focusMin').textContent=s.reduce(function(a,b){return a+(b.min||0);},0);
}
$('#focusToggle').addEventListener('click',function(){ F.running?focusPause():focusStart(); });
$('#focusReset').addEventListener('click',focusReset);
$('#focusSkip').addEventListener('click',focusDone);
$('#focusLen').addEventListener('click',function(e){
  var b=e.target.closest('button'); if(!b) return;
  S.set.focusMin=+b.getAttribute('data-min'); save();
  $$('#focusLen button').forEach(function(x){ x.classList.toggle('on',x===b); });
  if(F.phase==='work'&&!F.running){ F.remain=focusMs(); paintFocus(true); }
});

/* ================= notifikasi ================= */
function notify(title,body){
  if(!S.set.notify) return;
  if(!('Notification' in window)||Notification.permission!=='granted') return;
  try{ new Notification(title,{body:body,icon:'icons/icon-192.png',tag:'beres'}); }catch(e){}
}
var lastCheck='';
setInterval(function(){
  if(!S.set.notify) return;
  var now=nowHM(), td=today();
  if(now===lastCheck) return;
  lastCheck=now;
  S.tasks.forEach(function(t){
    if(t.done||!t.due||!t.time) return;
    if(t.due===td&&t.time===now) notify('Waktunya: '+t.title,'Jatuh tempo sekarang.');
  });
},20000);

/* App ketutup pas jam jatuh tempo = pengingat kelewat diam-diam.
 * Tagih sekali per sesi: toast (tanpa butuh izin) + Notification kalau granted. */
var nudged={};
function checkMissed(){
  var now=nowHM(), td=today(), miss=0, first=null;
  S.tasks.forEach(function(t){
    if(t.done||!t.due||!t.time||nudged[t.id]) return;
    if(t.due<td||(t.due===td&&t.time<now)){ nudged[t.id]=1; miss++; first=first||t; }
  });
  if(!miss) return;
  var msg=miss===1?('Lewat jatuh tempo: '+first.title):(miss+' tugas lewat jatuh tempo');
  toast(msg);
  notify('beres.',msg);
}

/* ================= statistik ================= */
function openStats(){
  var td=today(), d0=P.dayStart(new Date());
  var done=S.tasks.filter(function(t){return t.done&&t.doneAt;});
  var doneToday=done.filter(function(t){return P.ymd(new Date(t.doneAt))===td;}).length;
  var open=S.tasks.filter(function(t){return !t.done;}).length;
  var late=S.tasks.filter(function(t){return !t.done&&t.due&&t.due<td;}).length;

  /* streak: hari berturut-turut ada minimal 1 tugas kelar */
  var set={};
  done.forEach(function(t){ set[P.ymd(new Date(t.doneAt))]=1; });
  var streak=0;
  for(var i=0;i<400;i++){
    var k=P.ymd(P.addDays(d0,-i));
    if(set[k]) streak++;
    else if(i>0) break;
    else if(i===0) continue;   // hari ini belum kelar, streak boleh lanjut dari kemarin
  }
  var bars='',max=1,vals=[];
  for(var j=6;j>=0;j--){
    var day=P.addDays(d0,-j), key=P.ymd(day);
    var n=done.filter(function(t){return P.ymd(new Date(t.doneAt))===key;}).length;
    vals.push({d:day,n:n,now:key===td});
    if(n>max) max=n;
  }
  vals.forEach(function(v){
    bars+='<div class="chart__c'+(v.n?' has':'')+(v.now?' now':'')+'">'+
      '<i style="height:'+Math.round(v.n/max*76+3)+'px"></i>'+
      '<u>'+P.WD_PENDEK[v.d.getDay()][0]+'</u></div>';
  });

  var byP={};
  S.tasks.filter(function(t){return !t.done;}).forEach(function(t){
    var k=t.project||'_';
    byP[k]=(byP[k]||0)+1;
  });
  var rows=Object.keys(byP).sort(function(a,b){return byP[b]-byP[a];}).map(function(k){
    var p=proj(k), nm=p?p.name:'Tanpa proyek', c=p?p.color:'#7A7A74';
    var pc=Math.round(byP[k]/Math.max(1,open)*100);
    return '<div class="brk__r"><i class="dab" style="background:'+esc(c)+'"></i>'+
      '<span>'+esc(nm)+'</span><i class="trk"><i style="width:'+pc+'%;background:'+esc(c)+'"></i></i>'+
      '<b>'+byP[k]+'</b></div>';
  }).join('');

  var fs=S.sessions.filter(function(x){return x.d===td;});
  var fmin=fs.reduce(function(a,b){return a+(b.min||0);},0);

  $('#statsBody').innerHTML=
    '<div class="stat3">'+
      '<div class="stat stat--hero"><b>'+doneToday+'</b><small>kelar hari ini</small></div>'+
      '<div class="stat"><b>'+streak+'</b><small>hari beruntun</small></div>'+
    '</div>'+
    '<div class="stat3">'+
      '<div class="stat"><b>'+open+'</b><small>belum kelar</small></div>'+
      '<div class="stat"><b>'+late+'</b><small>kelewat</small></div>'+
      '<div class="stat"><b>'+fmin+'m</b><small>fokus hari ini</small></div>'+
    '</div>'+
    '<p class="label">7 hari terakhir</p><div class="chart">'+bars+'</div>'+
    (rows?'<p class="label">Sisa per proyek</p><div class="brk">'+rows+'</div>':'')+
    '<p class="note">Total '+done.length+' tugas kelar sejak pakai beres.</p>';
  openSheet($('#sheetStats'));
}

/* ================= setelan ================= */
function applySet(){
  var t=S.set.theme;
  if(t==='system') t=matchMedia('(prefers-color-scheme:light)').matches?'light':'dark';
  document.documentElement.setAttribute('data-theme',t);
  document.documentElement.setAttribute('data-accent',S.set.accent||'lime');
  var meta=$('meta[name=theme-color]');
  if(meta) meta.setAttribute('content',t==='light'?'#F7F6F2':'#0B0B0C');
  $$('#setTheme button').forEach(function(b){
    b.classList.toggle('on',b.getAttribute('data-theme')===S.set.theme);
  });
  $$('#setAccent button').forEach(function(b){
    b.classList.toggle('on',b.getAttribute('data-accent')===S.set.accent);
  });
  $$('[data-toggle]').forEach(function(b){
    b.setAttribute('aria-checked',S.set[b.getAttribute('data-toggle')]?'true':'false');
  });
  $$('#focusLen button').forEach(function(b){
    b.classList.toggle('on',+b.getAttribute('data-min')===(S.set.focusMin||25));
  });
}
matchMedia('(prefers-color-scheme:light)').addEventListener('change',function(){
  if(S.set.theme==='system') applySet();
});
$('#setTheme').addEventListener('click',function(e){
  var b=e.target.closest('button'); if(!b) return;
  S.set.theme=b.getAttribute('data-theme'); save(); applySet();
});
$('#setAccent').addEventListener('click',function(e){
  var b=e.target.closest('button'); if(!b) return;
  S.set.accent=b.getAttribute('data-accent'); save(); applySet();
});
document.addEventListener('click',function(e){
  var b=e.target.closest('[data-toggle]'); if(!b) return;
  var k=b.getAttribute('data-toggle');
  S.set[k]=!S.set[k];
  if(k==='notify'&&S.set.notify&&'Notification' in window&&Notification.permission==='default'){
    Notification.requestPermission().then(function(p){
      if(p!=='granted'){ S.set.notify=false; applySet(); save();
        toast('Izin notifikasi ditolak browser'); }
    });
  }
  save(); applySet();
  if(k==='hideDone') render();
});
$('#btnExport').addEventListener('click',function(){
  var blob=new Blob([JSON.stringify(S,null,2)],{type:'application/json'});
  var a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='beres-'+today()+'.json';
  a.click();
  setTimeout(function(){ URL.revokeObjectURL(a.href); },1000);
  toast('Cadangan diunduh');
});
$('#btnImport').addEventListener('click',function(){ $('#fileInput').click(); });
$('#fileInput').addEventListener('change',function(e){
  var f=e.target.files[0]; if(!f) return;
  var rd=new FileReader();
  rd.onload=function(){
    try{
      var d=JSON.parse(rd.result);
      if(!d||!Array.isArray(d.tasks)) throw 0;
      var want=d.tasks.length;
      var n2=norm(d); if(!n2) throw 0;
      S=n2; saveNow(); applySet(); render();
      closeSheet($('#sheetSet'));
      var drop=want-S.tasks.length;
      toast('Data dipulihkan'+(drop?' ('+drop+' entri rusak dibuang)':''));
    }catch(err){ toast('File nggak kebaca'); }
  };
  rd.readAsText(f);
  e.target.value='';
});
$('#btnWipe').addEventListener('click',function(){
  if(!confirm('Hapus SEMUA tugas dan setelan? Nggak bisa dibalikin.')) return;
  localStorage.removeItem(KEY);
  S=blank(); saveNow(); applySet(); render();
  closeSheet($('#sheetSet')); toast('Semua data dihapus');
});

/* ================= proyek ================= */
$('#btnAddProject').addEventListener('click',function(){
  var n=prompt('Nama proyek baru:');
  if(!n||!n.trim()) return;
  var p={id:'p-'+uid(),name:n.trim().slice(0,28),color:PAL[S.projects.length%PAL.length]};
  S.projects.push(p); save(); go('project',p.id);
});
$('#navProject').addEventListener('click',function(e){
  var b=e.target.closest('[data-project]'); if(!b) return;
  go('project',b.getAttribute('data-project'));
});
$('#navLabel').addEventListener('click',function(e){
  var b=e.target.closest('[data-label]'); if(!b) return;
  go('label',b.getAttribute('data-label'));
});

/* ================= nav + rak ================= */
$('#navView').addEventListener('click',function(e){
  var b=e.target.closest('[data-view]'); if(!b) return;
  go(b.getAttribute('data-view'));
});
$('#tabs').addEventListener('click',function(e){
  var b=e.target.closest('[data-view]');
  if(b){ go(b.getAttribute('data-view')); return; }
});
$('#tabFocus').addEventListener('click',function(){ focusOn(F.taskId); });
$('#tabStats').addEventListener('click',openStats);
$('#btnStats').addEventListener('click',openStats);
$('#btnSettings').addEventListener('click',function(){ applySet(); openSheet($('#sheetSet')); });
function openRak(){ $('#rak').classList.add('open'); $('#scrim').hidden=false; }
function closeRak(){ $('#rak').classList.remove('open');
  if(!openSheets.length) $('#scrim').hidden=true; }
$('#btnRakOpen').addEventListener('click',openRak);
$('#btnRakClose').addEventListener('click',closeRak);
$('#scrim').addEventListener('click',closeRak);
$('#fab').addEventListener('click',function(){ openTask(null); });

/* cari */
$('#btnFind').addEventListener('click',function(){
  var r=$('#findRow');
  r.hidden=!r.hidden;
  if(!r.hidden) $('#findInput').focus();
  else { q=''; $('#findInput').value=''; render(); }
});
$('#findInput').addEventListener('input',function(){ q=this.value.trim(); render(); });
$('#btnFindClear').addEventListener('click',function(){
  q=''; $('#findInput').value=''; $('#findRow').hidden=true; render();
});
/* urut */
var SORTS=['manual','priority','due','alpha'];
var SORTN={manual:'Manual',priority:'Prioritas',due:'Tenggat',alpha:'A ke Z'};
$('#btnSort').addEventListener('click',function(){
  var i=SORTS.indexOf(S.set.sort);
  S.set.sort=SORTS[(i+1)%SORTS.length];
  save(); render(); toast('Urut: '+SORTN[S.set.sort]);
});

/* ================= keyboard ================= */
document.addEventListener('keydown',function(e){
  var el=e.target;
  var typing=el&&el.matches&&el.matches('input,textarea,select');
  if(e.key==='Escape'){
    if(openSheets.length){ closeSheet(); return; }
    if(!$('#findRow').hidden){ q=''; $('#findInput').value=''; $('#findRow').hidden=true; render(); return; }
    if($('#rak').classList.contains('open')){ closeRak(); return; }
  }
  if(typing) return;
  if(e.key==='/'){ e.preventDefault(); $('#findRow').hidden=false; $('#findInput').focus(); return; }
  if(e.key==='n'||e.key==='N'){ e.preventDefault(); openTask(null); return; }
  if(e.key==='f'||e.key==='F'){ e.preventDefault(); focusOn(F.taskId); return; }
  if(e.key==='?'){ e.preventDefault(); toast('n tugas baru · / cari · f fokus · 1-5 pindah tab'); return; }
  var map={'1':'today','2':'upcoming','3':'inbox','4':'all','5':'done'};
  if(map[e.key]){ e.preventDefault(); go(map[e.key]); }
});

/* ================= mulai ================= */
S=load();
applySet();
(function seedTicks(){
  var h='';
  for(var i=0;i<28;i++) h+='<i></i>';
  $('#ticks').innerHTML=h;
})();
document.documentElement.setAttribute('data-phase','work');
F.remain=focusMs();
paintFocus(true);
renderFocusMeta();

if(!localStorage.getItem(KEY)){ seed(); saveNow(); }

/* Benih contoh. Dibuat langsung, TIDAK lewat addTask(), karena teks contoh
 * mengandung kata kunci ("besok jam 9 #keuangan") yang kalau diparse justru
 * memotong judulnya dan bikin proyek liar. */
function seed(){
  var td=today(), bsk=P.ymd(P.addDays(new Date(),1));
  function mk(o){
    return {id:'t-'+uid(),title:o.title,note:o.note||'',due:o.due||null,time:o.time||null,
      priority:o.p||0,project:null,labels:o.labels||[],repeat:o.repeat||null,
      subs:o.subs||[],done:false,doneAt:null,created:Date.now(),ord:S.seq++};
  }
  S.tasks=[
    mk({title:'Ketik kalimat biasa, tanggalnya kebaca sendiri',
        note:'Contoh: bayar kos besok jam 9 !p1 #keuangan',due:td}),
    mk({title:'Geser kartu ke kanan buat nandain kelar',due:td,labels:['tips']}),
    mk({title:'Geser ke kiri buat hapus',due:td,labels:['tips']}),
    mk({title:'Minum air',due:td,repeat:{unit:'day',interval:1,wd:null}}),
    mk({title:'Rapiin kamar',due:bsk,p:3,
        subs:[{t:'Beresin meja',done:false},{t:'Ganti sprei',done:false}]})
  ];
}
render();
document.body.classList.add('ready');
checkMissed();

window.addEventListener('beforeunload',saveNow);
document.addEventListener('visibilitychange',function(){
  if(document.visibilityState==='hidden') saveNow(); else checkMissed();
});

if('serviceWorker' in navigator){
  window.addEventListener('load',function(){
    navigator.serviceWorker.register('sw.js').catch(function(){});
  });
}

})();
