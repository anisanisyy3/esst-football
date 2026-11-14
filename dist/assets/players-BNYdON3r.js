import{f as d,h as o,i as t,b as s,t as e,s as p}from"./index-Bzu0St5_.js";import{d as m}from"./dataService-D6aeBORS.js";const $={title:"page.players",async render(r){const n=await d()?await o().catch(()=>null):null;if(!t(n)){r.innerHTML=`<section class="page-header"><h1>${s(e("players.title"))}</h1></section>
        <div class="empty-state"><p>${s(e("players.membersOnly"))}</p>
        <a href="/admin/login" data-link class="btn btn-primary">${e("nav.login")}</a></div>`;return}r.innerHTML=`<section class="page-header"><h1>${s(e("players.title"))}</h1><p class="page-sub">${s(e("players.subtitle"))}</p></section>
      <div id="players-list" class="loading">${s(e("common.loading"))}</div>`;try{const i=(await m.listMembers()||[]).filter(a=>t(a)),l=r.querySelector("#players-list");if(!i.length){l.innerHTML=`<div class="empty-state"><p>${s(e("players.empty"))}</p></div>`;return}l.innerHTML=`<div class="card-grid">${i.map(a=>`
        <a class="card player-card" href="/players/${a.id}" data-link>
          <div class="player-card-head">
            ${a.photo_url?`<img class="avatar" src="${s(a.photo_url)}" alt="" />`:`<div class="avatar avatar-fallback">${s((a.display_name||"?").slice(0,1).toUpperCase())}</div>`}
            <div>
              <strong>${s(a.display_name||a.full_name||"")}</strong>
              <div class="muted">${s(a.nickname||"")}</div>
            </div>
          </div>
          <div class="player-card-meta">
            <span class="badge">${e(`positions.${a.main_position||"midfielder"}`)}</span>
            <span class="badge badge-ovr">OVR ${a.ovr??60}</span>
          </div>
        </a>`).join("")}</div>`}catch{r.querySelector("#players-list").innerHTML=`<div class="error-state"><p>${s(e("errors.generic"))}</p></div>`,p(e("errors.generic"),"error")}}};export{$ as default};
