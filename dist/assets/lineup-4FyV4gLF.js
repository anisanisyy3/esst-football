import{f as A,h as P,i as C,b as n,t as s,j as O,F,s as q,v as N,k as B}from"./index-Bzu0St5_.js";import{d as u}from"./dataService-D6aeBORS.js";const z={title:"page.lineup",async render(c,S){const L=await A()?await P().catch(()=>null):null;if(!C(L)){c.innerHTML=`<div class="empty-state"><p>${n(s("players.membersOnly"))}</p></div>`;return}const y=S.id||S.matchId;c.innerHTML=`<div class="loading">${n(s("common.loading"))}</div>`;let m,d,j,v,h,g;try{if(m=await u.getMatch(y),d=await u.myMembership(),!d){c.innerHTML=`<div class="empty-state"><p>${n(s("myTeam.noTeam"))}</p></div>`;return}j=await u.getTeam(d.team_id),v=await u.listTeamMemberships(d.team_id),h=await u.getLineup(y,d.team_id),g=await u.suspendedIdsForMatch(y)}catch{c.innerHTML=`<div class="error-state"><p>${n(s("errors.generic"))}</p></div>`;return}const E=d.role_in_team==="captain"||O(L),$=!!h?.is_locked;let b=h?.formation||"4-3-3";const l=(h?.players||[]).map(e=>({player_id:e.player_id,jersey_number:e.jersey_number,match_position:e.match_position,is_starter:e.is_starter,is_captain:e.is_captain,is_vice_captain:e.is_vice_captain})),M=v.map(e=>e.player_id);c.innerHTML=`
      <section class="page-header">
        <h1>${n(s("lineup.title"))}</h1>
        <p class="page-sub">${n(j.name)} · ${n(m.home_team?.short_name||m.home_team_id)} vs ${n(m.away_team?.short_name||m.away_team_id)} · ${n(m.round_name||"")}</p>
      </section>
      ${$?`<div class="alert alert-info">${n(s("lineup.locked"))}</div>`:""}
      <div class="card">
        <div class="form-grid">
          <label>${s("lineup.formation")}<select id="formation" ${$?"disabled":""}>
            ${Object.keys(F).map(e=>`<option value="${e}" ${e===b?"selected":""}>${e}</option>`).join("")}
          </select></label>
        </div>
        <div id="pitch" class="pitch"></div>
      </div>
      <div class="card">
        <h3>${n(s("lineup.squad"))}</h3>
        <p class="muted">${n(s("lineup.squadHelp"))}</p>
        <div id="squad-list" class="squad-list"></div>
      </div>
      <div class="card">
        <h3>${n(s("lineup.selected"))}</h3>
        <div id="selected-list"></div>
        <div class="form-grid">
          <label>${s("lineup.tactics")}<textarea id="tactics" rows="3" ${$?"disabled":""} placeholder="${n(s("lineup.tacticsHelp"))}">${n(h?.tactics||"")}</textarea></label>
        </div>
        <div class="form-actions">
          ${E&&!$?`<button id="save-lineup" class="btn btn-primary" type="button">${s("common.save")}</button>`:""}
          <a href="/matches/${y}" data-link class="btn btn-outline">${s("common.back")}</a>
        </div>
        <div id="validation" class="validation-box"></div>
      </div>`;const k=c.querySelector("#squad-list"),_=c.querySelector("#selected-list"),T=c.querySelector("#validation"),x=c.querySelector("#pitch");function H(){k.innerHTML=v.map(e=>{const a=e.player||{},r=l.find(i=>i.player_id===e.player_id),t=g.has(e.player_id);return`<div class="squad-row ${r?"selected":""} ${t?"suspended":""}">
          <span class="jersey">${e.jersey_number??"—"}</span>
          <span class="squad-name">${n(a.display_name||e.player_id)}</span>
          <span class="badge">${s(`positions.${a.main_position||"midfielder"}`)}</span>
          ${t?`<span class="badge badge-danger">${s("lineup.suspended")}</span>`:""}
          ${E&&!$?r?`<button class="btn btn-ghost btn-xs" data-remove="${e.player_id}">${s("common.remove")}</button>`:`<button class="btn btn-primary btn-xs" data-add="${e.player_id}" data-pos="${a.main_position||"midfielder"}">${s("lineup.add")}</button>`:""}
        </div>`}).join(""),k.querySelectorAll("[data-add]").forEach(e=>{e.addEventListener("click",()=>{const a=e.dataset.add,r=e.dataset.pos,t=l.filter(p=>p.is_starter).length<11,i=v.find(p=>p.player_id===a)?.jersey_number??null;l.push({player_id:a,jersey_number:i,match_position:r,is_starter:t,is_captain:!1,is_vice_captain:!1}),f()})}),k.querySelectorAll("[data-remove]").forEach(e=>{e.addEventListener("click",()=>{const a=l.findIndex(r=>r.player_id===e.dataset.remove);a>=0&&l.splice(a,1),f()})})}function w(){_.innerHTML=l.map((e,a)=>{const r=v.find(t=>t.player_id===e.player_id)?.player||{};return`<div class="selected-row">
          <span>${n(r.display_name||e.player_id)}</span>
          <select class="sel-pos" data-i="${a}">
            ${["goalkeeper","defender","midfielder","forward"].map(t=>`<option value="${t}" ${e.match_position===t?"selected":""}>${s(`positions.${t}`)}</option>`).join("")}
          </select>
          <label class="chk"><input type="checkbox" class="sel-starter" data-i="${a}" ${e.is_starter?"checked":""} /> ${s("lineup.starter")}</label>
          <input class="sel-jersey" type="number" min="1" max="99" value="${e.jersey_number??""}" data-i="${a}" placeholder="#" />
          <label class="chk"><input type="checkbox" class="sel-captain" data-i="${a}" ${e.is_captain?"checked":""} /> C</label>
          <label class="chk"><input type="checkbox" class="sel-vice" data-i="${a}" ${e.is_vice_captain?"checked":""} /> VC</label>
        </div>`}).join(""),_.querySelectorAll(".sel-pos").forEach(e=>e.addEventListener("change",a=>{l[a.target.dataset.i].match_position=a.target.value,o()})),_.querySelectorAll(".sel-starter").forEach(e=>e.addEventListener("change",a=>{l[a.target.dataset.i].is_starter=a.target.checked,o()})),_.querySelectorAll(".sel-jersey").forEach(e=>e.addEventListener("change",a=>{l[a.target.dataset.i].jersey_number=a.target.value===""?null:Number(a.target.value),o()})),_.querySelectorAll(".sel-captain").forEach(e=>e.addEventListener("change",a=>{const r=a.target.dataset.i;l.forEach((t,i)=>{i!=r&&(t.is_captain=!1)}),l[r].is_captain=a.target.checked,o(),w()})),_.querySelectorAll(".sel-vice").forEach(e=>e.addEventListener("change",a=>{l[a.target.dataset.i].is_vice_captain=a.target.checked,o()}))}function I(){const e=B(b)||[];x.innerHTML=`<div class="pitch-grid">${e.map((a,r)=>{const t=l.filter(p=>p.is_starter)[r],i=t?v.find(p=>p.player_id===t.player_id)?.player:null;return`<div class="pitch-slot" data-slot="${r}">
          <span class="slot-label">${a}</span>
          ${t?`<span class="slot-player">${n(i?.display_name||t.player_id)}</span>`:'<span class="slot-empty">+</span>'}
        </div>`}).join("")}</div>`}function o(){const e=N({formation:b,players:l,eligiblePlayerIds:M,suspendedPlayerIds:[...g]});return T.innerHTML=e.valid?`<div class="alert alert-success">${s("lineup.valid")} (${e.checked.starters}+${e.checked.subs})</div>`:`<div class="alert alert-error">${e.errors.map(a=>s(a.split(":")[0])+(a.includes(":")?" "+a.split(":").slice(1).join(":"):"")).join("<br>")}</div>`,e.valid}function f(){H(),w(),I(),o()}c.querySelector("#formation")?.addEventListener("change",e=>{b=e.target.value,f()}),c.querySelector("#save-lineup")?.addEventListener("click",async()=>{if(!o()){q(s("lineup.invalid"),"error");return}const e=c.querySelector("#save-lineup");e.disabled=!0;try{const a=l.find(i=>i.is_captain),r=l.find(i=>i.is_vice_captain),t=c.querySelector("#tactics")?.value?.trim()||null;await u.saveLineup({matchId:y,teamId:d.team_id,formation:b,captainId:a?.player_id||null,viceCaptainId:r?.player_id||null,tactics:t,players:l.map(i=>({player_id:i.player_id,jersey_number:i.jersey_number,match_position:i.match_position,is_starter:i.is_starter,is_captain:i.is_captain,is_vice_captain:i.is_vice_captain}))}),q(s("lineup.saved"),"success")}catch(a){q(a?.message||s("errors.generic"),"error")}finally{e.disabled=!1}}),f()}};export{z as default};
