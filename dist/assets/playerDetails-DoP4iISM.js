import{f as b,h as _,i as w,b as a,t as s,m as M,o as H,s as L}from"./index-Bzu0St5_.js";import{d}from"./dataService-D6aeBORS.js";const O={title:"page.playerDetails",async render(r,m){const u=await b()?await _().catch(()=>null):null;if(!w(u)){r.innerHTML=`<div class="empty-state"><p>${a(s("players.membersOnly"))}</p></div>`;return}const l=m.id;r.innerHTML=`<div class="loading">${a(s("common.loading"))}</div>`;try{const t=await d.getProfileById(l);if(!t){r.innerHTML=`<div class="empty-state"><p>${a(s("errors.notFound"))}</p></div>`;return}const o=await d.fetchPlayerRecords(l),v=o.appearances||[],g=o.matches||[],f=o.events||[],P=[],p=new Map;for(const i of v){const e=g.find(c=>c.id===i.match_id);!e||e.status!=="finished"||p.has(e.id)||p.set(e.id,{match:e,appearances:v.filter(c=>c.match_id===e.id),events:f.filter(c=>c.match_id===e.id)})}const n=M(l,[...p.values()]),$=H?await d.getOvrHistory(l):{ledger:await d.getOvrLedger(l),history:{current:t.ovr,perMatch:[]}},y=$.ledger||[],h=await d.getSuspensions(l);r.innerHTML=`
        <section class="page-header"><h1>${a(t.display_name||t.full_name||"")}</h1>
          <p class="page-sub">${a(t.nickname||"")}</p></section>
        <div class="card">
          <div class="player-card-head">
            ${t.photo_url?`<img class="avatar avatar-lg" src="${a(t.photo_url)}" alt="" />`:`<div class="avatar avatar-lg avatar-fallback">${a((t.display_name||"?").slice(0,1).toUpperCase())}</div>`}
            <div>
              <p><strong>${a(s("profile.mainPosition"))}:</strong> ${a(s(`positions.${t.main_position||"midfielder"}`))}</p>
              ${t.secondary_position?`<p><strong>${a(s("profile.secondaryPosition"))}:</strong> ${a(s(`positions.${t.secondary_position}`))}</p>`:""}
              <p><strong>${a(s("profile.preferredFoot"))}:</strong> ${a(s(`foot.${t.preferred_foot||"right"}`))}</p>
              <p><strong>OVR:</strong> ${t.ovr??60}</p>
            </div>
          </div>
        </div>
        <section class="section"><h2 class="section-title">${a(s("stats.career"))}</h2>
          <div class="stat-grid">
            <div class="stat-card"><span class="stat-value">${n.matches_played}</span><span class="stat-label">${s("stats.matches")}</span></div>
            <div class="stat-card"><span class="stat-value">${n.wins}</span><span class="stat-label">${s("stats.wins")}</span></div>
            <div class="stat-card"><span class="stat-value">${n.draws}</span><span class="stat-label">${s("stats.draws")}</span></div>
            <div class="stat-card"><span class="stat-value">${n.losses}</span><span class="stat-label">${s("stats.losses")}</span></div>
            <div class="stat-card"><span class="stat-value">${n.goals}</span><span class="stat-label">${s("stats.goals")}</span></div>
            <div class="stat-card"><span class="stat-value">${n.assists}</span><span class="stat-label">${s("stats.assists")}</span></div>
            <div class="stat-card"><span class="stat-value">${n.yellow_cards}</span><span class="stat-label">${s("stats.yellowCards")}</span></div>
            <div class="stat-card"><span class="stat-value">${n.red_cards}</span><span class="stat-label">${s("stats.redCards")}</span></div>
            <div class="stat-card"><span class="stat-value">${n.minutes_played}</span><span class="stat-label">${s("stats.minutes")}</span></div>
            <div class="stat-card"><span class="stat-value">${n.clean_sheets}</span><span class="stat-label">${s("stats.cleanSheets")}</span></div>
          </div>
        </section>
        <section class="section"><h2 class="section-title">${a(s("ovr.history"))}</h2>
          <div class="table-wrap"><table class="standings-table"><thead><tr><th>${s("ovr.match")}</th><th>${s("ovr.before")}</th><th>${s("ovr.delta")}</th><th>${s("ovr.after")}</th><th>${s("ovr.reasons")}</th></tr></thead><tbody>
            ${($.history?.perMatch||[]).map(i=>`<tr><td>${a(i.match_id)}</td><td>${i.before}</td><td>${i.delta>0?"+":""}${i.delta}</td><td>${i.after}</td><td>${a(y.filter(e=>e.match_id===i.match_id).map(e=>e.reason+" "+(e.delta>0?"+":"")+e.delta).join(", "))}</td></tr>`).join("")||`<tr><td colspan="5" class="muted">${a(s("common.empty"))}</td></tr>`}
          </tbody></table></div>
        </section>
        ${h.length?`<section class="section"><h2 class="section-title">${a(s("suspensions.title"))}</h2>
          <ul>${h.map(i=>`<li>${a(i.status)} — ${a(i.red_card_match_id)}</li>`).join("")}</ul></section>`:""}`}catch{r.innerHTML=`<div class="error-state"><p>${a(s("errors.generic"))}</p></div>`,L(s("errors.generic"),"error")}}};export{O as default};
