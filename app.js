'use strict';
const data = window.dwsSnapshot;
const view = document.getElementById('view');
const nav = [...document.querySelectorAll('[data-page]')];
const number = new Intl.NumberFormat('en-NZ');
const fmt = value => value == null || value === '' ? '—' : typeof value === 'number' ? number.format(value) : String(value);
const esc = value => fmt(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]);
const card = (title, body, extra='') => '<section class="card '+extra+'"><h3>'+esc(title)+'</h3>'+body+'</section>';
const rows = pairs => '<dl>'+pairs.map(([key,value])=>'<div><dt>'+esc(key)+'</dt><dd>'+esc(value)+'</dd></div>').join('')+'</dl>';
const metrics = pairs => '<div class="metrics">'+pairs.map(([key,value])=>'<div class="metric"><small>'+esc(key)+'</small><strong>'+esc(value)+'</strong></div>').join('')+'</div>';
const table = (head, body) => '<div class="table-wrap"><table><thead><tr>'+head.map(h=>'<th scope="col">'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+body.map(row=>'<tr>'+row.map(v=>'<td>'+esc(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
function tabs(names, selected, action) {
  const bar = document.createElement('div');
  bar.className = 'tabs';
  for (const name of names) {
    const button = document.createElement('button');
    button.textContent = name;
    button.setAttribute('aria-pressed', String(name === selected));
    button.addEventListener('click', () => {
      action(name);
      [...view.querySelectorAll('.tabs button')].find(item => item.textContent === name)?.focus();
    });
    bar.append(button);
  }
  return bar;
}
const profile = data.Profile.findLast(entry=>entry.Summary)?.Summary || {};
const profileTabs = ['Dashboard','CP & Combat','CP Details','Military','Life','Capture History'];
const profileSections = ['','CP and Combat Statistics','CP Details comparison','Military','Life'];
const captured = prefix => data.Profile.findLast(x=>x.Label.startsWith(prefix))?.Text || '';
function scanControls(...labels) {
  return '<div class="scan-controls" aria-label="Desktop scan controls">' +
    labels.map(label => '<button type="button" disabled>' + esc(label) + '</button>').join('') +
    '<span>Scanning is available in the Windows app.</span></div>';
}
const cpText = captured('CP and Combat Statistics');
const read = (input, label) => input.split(/\r?\n/).find(line=>line.startsWith(label+' '))?.slice(label.length).trim();
function home(section='Dashboard') {
  view.innerHTML = scanControls('Scan profile','Scan More') + '<section class="card"><h2>'+esc(profile.Survivor)+' &nbsp; | &nbsp; '+esc(profile.Alliance)+'</h2>'+
    metrics([['Combat power',profile.CP],['Kills',profile.Kills],['State',profile.State],['VIP',profile.VIP],['Likes',profile.Likes]])+'</section>';
  view.append(tabs(profileTabs,section,home));
  if (section === 'Capture History') {
    const select = document.createElement('select');
    select.setAttribute('aria-label','Saved profile capture');
    for (const [index,entry] of data.Profile.entries()) select.add(new Option(entry.Label,index));
    const panel = document.createElement('section');
    panel.className = 'card';
    const text = document.createElement('pre');
    const update = () => {text.textContent = data.Profile[select.value]?.Text || 'No saved entries.';};
    select.addEventListener('change',update);
    panel.append(select,text);
    view.append(panel);
    update();
    return;
  }
  if (section !== 'Dashboard') {
    view.insertAdjacentHTML('beforeend',card(section,'<pre>'+esc(captured(profileSections[profileTabs.indexOf(section)]))+'</pre>'));
    return;
  }
  const categories=['Troop','Hero','Structure','Tech','Mod Vehicle','Pet Agent'].map(name=>[name,Number((read(cpText,name+' CP')||'0').replaceAll(',',''))]);
  const total=categories.reduce((sum,[,value])=>sum+value,0);
  const colors=['#ffd178','#7bd5c7','#83abf6','#48a8b3','#c6a17a','#9a96ae'];
  let cursor=0;
  const arcs=categories.map(([,value],i)=>{
    const start=cursor;
    cursor+=total ? value/total*360 : 0;
    return colors[i]+' '+start+'deg '+Math.max(start,cursor-1.7)+'deg, #101d22 '+Math.max(start,cursor-1.7)+'deg '+cursor+'deg';
  });
  const donut=total ? '<div class="chart" style="background:conic-gradient('+arcs.join(',')+')"><span>'+((categories[0][1]/total)*100).toFixed(1)+'%<br>Troop</span></div>' : '';
  const breakdown=rows(categories.map(([name,value],i)=>[name,number.format(value)+' · '+(total ? (value/total*100).toFixed(1)+'%' : '—')]));
  const activity=card('Combat Record',rows(['Victory','Defeat','Lost','Scout Times'].map(key=>[key,read(cpText,key)])));
  const details=captured('CP Details comparison');
  const record=card('Profile Record',rows([['Highest CP',read(cpText,'Highest CP on Record')],['Watchtower',read(details,'Watchtower')],['Overall grade',read(details,'Overall grade')],['State',profile.State]]));
  view.insertAdjacentHTML('beforeend','<div class="home-grid"><div class="stack">'+activity+record+'</div>'+card('CP Breakdown',donut+breakdown)+'<div class="art" role="img" aria-label="Armored vehicle in a hangar"></div></div>');
}
const newest = [...data.History].reverse();
function roster() {
  const names=[...new Set(newest.filter(x=>x.Hero).map(x=>x.Hero))];
  const combined=names.map(name=>{
    const s=newest.find(x=>x.Hero===name&&x.Level!=null)||{};
    const p=newest.find(x=>x.Hero===name&&x.FullStars!=null)||{};
    return [name,s.Level,s.Power,s.ATK,s.DEF,s.TroopSize,p.FullStars==null?null:p.FullStars+' + '+(p.StarSegments||0)+'/5',Array.isArray(p.Skills)?p.Skills.join(', '):p.Skills];
  }).sort((a,b)=>(b[2]||0)-(a[2]||0));
  view.innerHTML=scanControls('Scan All Heroes','Scan Stars and Skills')+card('Hero Roster · '+names.length,table(['Hero','Lv.','CP','ATK','DEF','Troop size','Stars','Skills'],combined));
}
function formation(section='March 1') {
  view.replaceChildren(tabs(['March 1','March 2','March 3','March 4'],section,formation));
  const march=Number(section.at(-1));
  const current=newest.find(x=>x.Troop===march)||{};
  const lineup=newest.find(x=>x.Troop===march&&x.Heroes?.length)?.Heroes||[];
  const counts=newest.find(x=>x.Troop===march&&x.UnitCounts)?.UnitCounts||{};
  view.insertAdjacentHTML('beforeend',card(section,metrics([['Combat power',current.Power],['Troops',current.CurrentTroops],['Capacity',current.TroopCapacity],['Type',current.FormationType],['Bonus',current.Bonus==null?null:current.Bonus+'%'],['Chip preset',current.ChipPreset]])+
    '<h3>Lineup</h3><ol>'+lineup.map(hero=>'<li>'+esc(hero)+'</li>').join('')+'</ol>'+rows(Object.entries(counts))));
}
const workshopPresets=[['I','Fighter',9560000,3,[3,3,3,3]],['II','Shooter',6570000,2,[2,2,2,2]],['III','Rider',6570000,2,[2,2,2,2]],['IV','Fighter',3844000,0,[2,1,2,3]]];
function modding(section='Overview',preset='I') {
  view.replaceChildren(tabs(['Overview','Chips'],section,modding));
  if(section==='Overview'){
    view.insertAdjacentHTML('beforeend',card('Armored Personnel Carrier',metrics([['APC level','284 · 53%'],['CP',27883200],['ATK','+42,600'],['DEF','+42,600'],['Troop size','+1,920']])+table(['Part','Tier','Level'],[['Engine',2,25],['Armor',2,24],['Chassis',2,24],['Weapon',2,25],['Optics',2,24],['Comms',2,25]])));
    return;
  }
  view.append(tabs(workshopPresets.map(p=>p[0]),preset,selected=>modding('Chips',selected)));
  const selected=workshopPresets.find(p=>p[0]===preset);
  view.insertAdjacentHTML('beforeend',card(selected[1]+' Chipset',metrics([['Combat power',selected[2]],['Resonance','★'.repeat(selected[3])+'☆'.repeat(5-selected[3])]])+rows(['Weapon','Vehicle core','Radar','Shield'].map((name,i)=>[name,'◆'.repeat(selected[4][i])+'◇'.repeat(5-selected[4][i])])), 'chip-art'));
}
function research(section=Object.keys(data.Research)[0]) {
  view.replaceChildren(tabs(Object.keys(data.Research),section,research));
  view.insertAdjacentHTML('beforeend',scanControls('Start capture'));
  const entry=data.Research[section];
  view.insertAdjacentHTML('beforeend',card(section,'<p class="muted">'+esc(entry.Coverage)+'</p>'+table(['Node','Current','Max','Levels left','Status'],entry.Nodes.map(n=>[n.Name,n.Current,n.Max,n.Max-n.Current,n.InProgress?'Researching':'—']))));
}
function history() {
  view.innerHTML=card('Progress History',table(['Captured','Entry','CP','Level','ATK','DEF','Troop size','Stars','Skills'],newest.map(x=>[x.Observed,x.Hero||('March '+x.Troop),x.Power,x.Level,x.ATK,x.DEF,x.TroopSize,x.FullStars==null?null:x.FullStars+' + '+(x.StarSegments||0)+'/5',Array.isArray(x.Skills)?x.Skills.join(', '):x.Skills])));
}
function review(){
  view.innerHTML=card('Review',table(['Captured','Entry','Read CP','Status','Reason'],[...data.Review].reverse().map(x=>[x.Observed,x.Hero||(x.Troop?'March '+x.Troop:null),x.Power,x.Dismissed?'Dismissed':'Pending review',x.Reason])));
}
const pages={'Home':home,'Hero Roster':roster,'Formation':formation,'Modding Workstation':modding,'Research':research,'Progress History':history,'Review':review};
function show(page){
  document.getElementById('heading').textContent=page;
  for(const button of nav){
    if(button.dataset.page===page) button.setAttribute('aria-current','page');
    else button.removeAttribute('aria-current');
  }
  pages[page]();
}
for(const button of nav) button.addEventListener('click',()=>show(button.dataset.page));
show('Home');
