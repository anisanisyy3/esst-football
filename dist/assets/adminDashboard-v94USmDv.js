import{t as e,b as m,w as Y,s as p,c as z,d as B,g as j,x as I,e as F,y as Z,f as ee,n as x,h as te,o as ae,z as P}from"./index-Bzu0St5_.js";import{d as u,s as se}from"./dataService-D6aeBORS.js";import{a as A,l as K,i as ne}from"./settingsCache-Cu85K49s.js";import{c as ie}from"./stats-CiPQW6v9.js";import{i as re,w as oe,a as le,b as D,f as de}from"./dateFormat-g4eR_ppz.js";import{s as ce}from"./matchCard-CpERVok9.js";async function me(t,i){let a,n;try{[a,n]=await Promise.all([u.listMatches(),u.listTeams()])}catch(l){t.append(ue(e(l?.key??"errors.loadFailed"),()=>i.reload()));return}t.innerHTML=`
  <div class="section-toolbar">
    <h2 class="section-title">${e("admin.section.matches")}</h2>
    <button id="match-add" class="btn btn-primary" type="button">+ ${e("admin.matches.add")}</button>
  </div>
  <div id="match-form-slot"></div>
  <div id="match-list"></div>`;const s=t.querySelector("#match-list"),o=t.querySelector("#match-form-slot");t.querySelector("#match-add").addEventListener("click",()=>h(null));const d=()=>{if(!a.length){s.innerHTML="",s.append(z({icon:"📋",message:e("admin.matches.empty")}));return}const l=[...a].sort((r,c)=>c.kickoff_at.localeCompare(r.kickoff_at));s.innerHTML=l.map(v).join(""),s.querySelectorAll("[data-edit]").forEach(r=>r.addEventListener("click",()=>h(a.find(c=>c.id===r.dataset.edit)))),s.querySelectorAll("[data-delete]").forEach(r=>r.addEventListener("click",()=>$(r.dataset.delete)))};function v(l){const r=l.home_team,c=l.away_team,y=l.home_score!==null&&l.away_score!==null;return`
    <div class="admin-row">
      <div class="admin-row-main">
        <span class="admin-row-teams">
          ${B(r,28,"team-logo team-logo-xs")}
          <strong>${m(r?.name??"—")}</strong>
          <span class="admin-score" dir="ltr">${y?`${l.home_score} – ${l.away_score}`:"·"}</span>
          <strong>${m(c?.name??"—")}</strong>
          ${B(c,28,"team-logo team-logo-xs")}
        </span>
        <span class="admin-row-meta">
          ${le(l.kickoff_at,j(),A())}
          ${l.round_name?` · ${m(l.round_name)}`:""}
          ${l.venue?` · ${m(l.venue)}`:""}
          · ${e("common.updatedAt")} ${D(l.updated_at,j(),A())}
        </span>
      </div>
      <div class="admin-row-actions">
        ${ce(l.status)}
        <button class="btn btn-ghost btn-sm" data-edit="${l.id}" type="button">${e("common.edit")}</button>
        ${i.superAdmin?`<button class="btn btn-danger-ghost btn-sm" data-delete="${l.id}" type="button">${e("common.delete")}</button>`:""}
      </div>
    </div>`}function b(l){const r=n.map(c=>`<option value="${c.id}" ${c.id===l?"selected":""}>${m(c.name)}${c.archived?` (${e("admin.teams.archived")})`:""}</option>`).join("");return`<option value="">${e("admin.form.selectTeam")}</option>${r}`}function h(l=null){const r=!!l,c=l?.status??"scheduled",y=c==="live"||c==="finished",E=l?re(l.kickoff_at,A()):"";o.innerHTML=`
    <form id="match-form" class="panel form-grid" novalidate>
      <h3 class="panel-title">${r?e("admin.matches.editTitle"):e("admin.matches.newTitle")}</h3>
      <div class="field">
        <label for="f-home">${e("admin.form.homeTeam")}</label>
        <select id="f-home">${b(l?.home_team_id)}</select>
        <span class="field-error" data-err="teams"></span>
      </div>
      <div class="field">
        <label for="f-away">${e("admin.form.awayTeam")}</label>
        <select id="f-away">${b(l?.away_team_id)}</select>
      </div>
      <div class="field">
        <label for="f-kickoff">${e("admin.form.kickoff")}</label>
        <input id="f-kickoff" type="datetime-local" value="${E}" />
        <span class="field-error" data-err="kickoff_at"></span>
      </div>
      <div class="field">
        <label for="f-status">${e("admin.form.status")}</label>
        <select id="f-status">
          ${["scheduled","live","finished","postponed","cancelled"].map(g=>`<option value="${g}" ${g===c?"selected":""}>${e(`status.${g}`)}</option>`).join("")}
        </select>
      </div>
      <div class="field">
        <label for="f-round">${e("admin.form.round")}</label>
        <input id="f-round" type="text" maxlength="40" value="${m(l?.round_name??"")}" />
      </div>
      <div class="field">
        <label for="f-venue">${e("admin.form.venue")}</label>
        <input id="f-venue" type="text" maxlength="80" value="${m(l?.venue??"")}" />
      </div>
      <div class="field">
        <label for="f-hscore">${e("admin.form.homeScore")}</label>
        <input id="f-hscore" type="number" min="0" step="1" value="${l?.home_score??""}" ${y?"":"disabled"} />
      </div>
      <div class="field">
        <label for="f-ascore">${e("admin.form.awayScore")}</label>
        <input id="f-ascore" type="number" min="0" step="1" value="${l?.away_score??""}" ${y?"":"disabled"} />
        <span class="field-error" data-err="scores"></span>
      </div>
      <div class="form-actions">
        <button class="btn btn-ghost" type="button" id="f-cancel">${e("common.cancel")}</button>
        <button class="btn btn-primary" type="submit">${e("common.save")}</button>
      </div>
      <div id="form-alert"></div>
    </form>`,o.scrollIntoView({behavior:"smooth",block:"nearest"});const f=o.querySelector("#match-form"),w=f.querySelector("#f-status"),q=f.querySelector("#f-hscore"),L=f.querySelector("#f-ascore"),N=()=>{const g=w.value==="live"||w.value==="finished";q.disabled=!g,L.disabled=!g,g?(q.value===""&&(q.value="0"),L.value===""&&(L.value="0")):(q.value="",L.value="")};w.addEventListener("change",N),f.querySelector("#f-cancel").addEventListener("click",()=>{o.innerHTML=""});let k=!1;f.addEventListener("submit",async g=>{if(g.preventDefault(),k)return;k=!0;const S=f.querySelector("button[type=submit]");S.disabled=!0,S.textContent=e("common.saving"),f.querySelectorAll(".field-error").forEach(T=>T.textContent=""),f.querySelector("#form-alert").innerHTML="";const J=f.querySelector("#f-kickoff").value,_={home_team_id:f.querySelector("#f-home").value,away_team_id:f.querySelector("#f-away").value,kickoff_at:oe(J,A()),venue:f.querySelector("#f-venue").value,round_name:f.querySelector("#f-round").value,status:w.value,home_score:q.disabled?null:q.value,away_score:L.disabled?null:L.value},{valid:Q,errors:X}=Y(_);if(!Q){for(const[T,R]of Object.entries(X)){const G=f.querySelector(`[data-err="${T}"]`);G?G.textContent=e(R):p(e(R),"error")}k=!1,S.disabled=!1,S.textContent=e("common.save");return}const W={home_team_id:_.home_team_id,away_team_id:_.away_team_id,kickoff_at:_.kickoff_at,venue:_.venue.trim()||null,round_name:_.round_name.trim()||null,status:_.status,home_score:_.home_score===null?null:Number(_.home_score),away_score:_.away_score===null?null:Number(_.away_score)};try{r?(await u.updateMatch(l.id,W),p(e("admin.matches.updated"))):(await u.createMatch(W),p(e("admin.matches.created"))),o.innerHTML="",await i.refresh()}catch(T){const R=f.querySelector("#form-alert");R.innerHTML=`<div class="alert alert-error">${e(T?.key??"errors.saving")}${T?.detail&&T.key==="errors.generic"?` <code>${m(T.detail)}</code>`:""}</div>`,k=!1,S.disabled=!1,S.textContent=e("common.save")}})}async function $(l){const r=a.find(y=>y.id===l);if(await I({title:e("confirm.deleteMatchTitle"),message:`${e("confirm.deleteMatchBody")}
${r?`${r.home_team?.name??""} – ${r.away_team?.name??""}`:""}`,confirmLabel:e("common.delete"),cancelLabel:e("common.cancel")}))try{await u.deleteMatch(l),p(e("admin.matches.deleted")),await i.refresh()}catch(y){p(e(y?.key??"errors.generic"),"error")}}d()}function ue(t,i){const a=document.createElement("div");if(a.className="alert alert-error",a.textContent=t,i){const n=document.createElement("button");n.className="btn btn-ghost btn-sm",n.type="button",n.textContent=e("common.retry"),n.addEventListener("click",i),a.append(n)}return a}async function pe(t,i){let a,n;try{[a,n]=await Promise.all([u.listTeams(),u.listMatches()])}catch(r){t.innerHTML="",t.append(F({message:e(r?.key??"errors.loadFailed"),retryLabel:e("common.retry"),onRetry:()=>i.refresh()}));return}const s=r=>n.filter(c=>c.home_team_id===r||c.away_team_id===r).length;t.innerHTML=`
  <div class="section-toolbar">
    <h2 class="section-title">${e("admin.section.teams")}</h2>
    <button id="team-add" class="btn btn-primary" type="button">+ ${e("admin.teams.add")}</button>
  </div>
  <div id="team-form-slot"></div>
  <div id="team-list" class="admin-team-list"></div>`;const o=t.querySelector("#team-list"),d=t.querySelector("#team-form-slot");t.querySelector("#team-add").addEventListener("click",()=>h(null));const v=()=>{if(!a.length){o.innerHTML="",o.append(z({icon:"👕",message:e("admin.teams.empty")}));return}o.innerHTML=a.map(b).join(""),o.querySelectorAll("[data-edit]").forEach(r=>r.addEventListener("click",()=>h(a.find(c=>c.id===r.dataset.edit)))),o.querySelectorAll("[data-archive]").forEach(r=>r.addEventListener("click",()=>$(r.dataset.archive))),o.querySelectorAll("[data-delete]").forEach(r=>r.addEventListener("click",()=>l(r.dataset.delete)))};function b(r){const c=s(r.id);return`
    <div class="admin-row${r.archived?" admin-row-muted":""}">
      <div class="admin-row-main">
        <span class="admin-row-teams">
          ${B(r,30,"team-logo team-logo-xs")}
          <strong>${m(r.name)}</strong>
          <span class="tag">${m(r.short_name??"")}</span>
          ${r.archived?`<span class="badge badge-archived">${e("admin.teams.archived")}</span>`:""}
        </span>
        <span class="admin-row-meta">
          ${e("admin.teams.matchesCount",{count:c})} · ${e("teams.created")} ${de(r.created_at,j(),"UTC")}
        </span>
      </div>
      <div class="admin-row-actions">
        <button class="btn btn-ghost btn-sm" data-edit="${r.id}" type="button">${e("common.edit")}</button>
        <button class="btn btn-ghost btn-sm" data-archive="${r.id}" type="button">
          ${r.archived?e("admin.teams.restore"):e("admin.teams.archive")}
        </button>
        <button class="btn btn-danger-ghost btn-sm" data-delete="${r.id}" type="button">${e("common.delete")}</button>
      </div>
    </div>`}function h(r=null){d.innerHTML=`
    <form id="team-form" class="panel form-grid" novalidate>
      <h3 class="panel-title">${r?e("admin.teams.editTitle"):e("admin.teams.newTitle")}</h3>
      <div class="field">
        <label for="tf-name">${e("admin.form.teamName")}</label>
        <input id="tf-name" type="text" maxlength="60" value="${m(r?.name??"")}" />
        <span class="field-error" data-err="name"></span>
      </div>
      <div class="field">
        <label for="tf-short">${e("admin.form.shortName")}</label>
        <input id="tf-short" type="text" maxlength="6" value="${m(r?.short_name??"")}" />
        <span class="field-error" data-err="short_name"></span>
      </div>
      <div class="field">
        <label for="tf-logo">${e("admin.form.logoUrl")}</label>
        <input id="tf-logo" type="url" placeholder="https://…" value="${m(r?.logo_url??"")}" />
        <span class="field-error" data-err="logo_url"></span>
      </div>
      <div class="field field-wide">
        <label for="tf-desc">${e("admin.form.description")}</label>
        <textarea id="tf-desc" rows="2" maxlength="300">${m(r?.description??"")}</textarea>
      </div>
      <div class="form-actions">
        <button class="btn btn-ghost" type="button" id="tf-cancel">${e("common.cancel")}</button>
        <button class="btn btn-primary" type="submit">${e("common.save")}</button>
      </div>
      <div id="tf-alert"></div>
    </form>`,d.scrollIntoView({behavior:"smooth",block:"nearest"});const c=d.querySelector("#team-form");c.querySelector("#tf-cancel").addEventListener("click",()=>d.innerHTML="");let y=!1;c.addEventListener("submit",async E=>{if(E.preventDefault(),y)return;y=!0;const f=c.querySelector("button[type=submit]");f.disabled=!0,f.textContent=e("common.saving"),c.querySelectorAll(".field-error").forEach(k=>k.textContent=""),c.querySelector("#tf-alert").innerHTML="";const w={name:c.querySelector("#tf-name").value,short_name:c.querySelector("#tf-short").value,logo_url:c.querySelector("#tf-logo").value,description:c.querySelector("#tf-desc").value},{valid:q,errors:L}=Z(w);if(!q){for(const[k,g]of Object.entries(L)){const S=c.querySelector(`[data-err="${k}"]`);S?S.textContent=e(g):p(e(g),"error")}y=!1,f.disabled=!1,f.textContent=e("common.save");return}const N={name:w.name.trim(),short_name:w.short_name.trim(),logo_url:w.logo_url.trim()||null,description:w.description.trim()||null};try{r?(await u.updateTeam(r.id,N),p(e("admin.teams.updated"))):(await u.createTeam(N),p(e("admin.teams.created"))),d.innerHTML="",await i.refresh()}catch(k){const g=c.querySelector("#tf-alert");g.innerHTML=`<div class="alert alert-error">${e(k?.key??"errors.saving")}</div>`,y=!1,f.disabled=!1,f.textContent=e("common.save")}})}async function $(r){const c=a.find(y=>y.id===r);try{await u.updateTeam(r,{archived:!c?.archived}),p(c?.archived?e("admin.teams.restore"):e("admin.teams.archive")),await i.refresh()}catch(y){p(e(y?.key??"errors.generic"),"error")}}async function l(r){a.find(E=>E.id===r);const c=s(r);if(await I({title:e("common.delete"),message:c>0?e("admin.teams.deleteWarning",{count:c}):e("admin.teams.deleteSimple"),extraHtml:c>0?`<label class="check-line"><input type="checkbox" id="tf-confirm-delete"> ${e("admin.teams.confirmDelete")}</label>`:"",requireCheckbox:c>0?"#tf-confirm-delete":null,confirmLabel:e("common.delete"),cancelLabel:e("common.cancel")}))try{await u.deleteTeam(r),p(e("admin.teams.deleted")),await i.refresh()}catch(E){p(e(E?.key??"errors.generic"),"error")}}v()}const U=[{id:"overview",key:"admin.section.overview",icon:"📊",roles:["score_manager","super_admin"]},{id:"matches",key:"admin.section.matches",icon:"⚽",roles:["score_manager","super_admin"]},{id:"reports",key:"admin.section.reports",icon:"📝",roles:["score_manager","super_admin"]},{id:"teams",key:"admin.section.teams",icon:"🛡️",roles:["super_admin"]},{id:"requests",key:"admin.section.requests",icon:"📥",roles:["super_admin"]},{id:"managers",key:"admin.section.managers",icon:"👤",roles:["super_admin"]},{id:"settings",key:"admin.section.settings",icon:"⚙️",roles:["super_admin"]},{id:"audit",key:"admin.section.audit",icon:"🕘",roles:["super_admin"]}],xe={title:"page.adminDashboard",async render(t,i){let a,n;try{if(a=await ee(),!a){sessionStorage.setItem("esst_auth_notice","expired"),x("/admin/login",{replace:!0});return}n=a.profile??await te()}catch(l){ke(t,l);return}const s=n?.role??"pending";if(s==="pending"){qe(t,n);return}const o=s==="super_admin";let d=i.section??"overview";U.some(l=>l.id===d&&l.roles.includes(s))||(d="overview"),await K();const v=U.filter(l=>l.roles.includes(s));if(!v.length){Se(t,n);return}const b=v.find(l=>l.id===d)??v[0];t.innerHTML=`
    <div class="admin-shell">
      <aside class="admin-sidebar">
        <div class="admin-side-head">
          <span class="admin-role tag tag-accent">${e(`admin.role.${s}`)}</span>
        </div>
        <nav class="admin-nav" aria-label="${e("page.adminDashboard")}">
          ${v.map(l=>`
              <a href="/admin/${l.id}" data-link
                 class="admin-nav-link${l.id===b.id?" active":""}"
                 ${l.id===b.id?'aria-current="page"':""}>
                <span aria-hidden="true">${l.icon}</span> ${e(l.key)}
              </a>`).join("")}
        </nav>
        <div class="admin-side-foot">
          <a href="/" data-link class="admin-nav-link">🏠 ${e("admin.backToSite")}</a>
          <button id="admin-logout" class="btn btn-outline btn-sm btn-block" type="button">
            ${e("auth.logout")??""}
          </button>
        </div>
      </aside>
      <div class="admin-content">
        <header class="admin-topbar">
          <p class="admin-welcome">${e("admin.welcome",{name:m(n.display_name||n.email)})}</p>
          ${ae?`<span class="badge badge-demo">${e("demo.badge")}</span>`:""}
        </header>
        <div id="admin-section" class="admin-section"></div>
      </div>
    </div>`,t.querySelector("#admin-logout").addEventListener("click",async()=>{await P(),p(e("auth.loggedOut")),x("/")});const h=t.querySelector("#admin-section");await H(h,b.id,{profile:n,superAdmin:o});let $=null;this._unsub=se(()=>{clearTimeout($),$=setTimeout(async()=>{const l=t.querySelector("#admin-section");!l||!l.isConnected||(b.id==="overview"||b.id==="matches")&&await H(l,b.id,{profile:n,superAdmin:o})},400)})},destroy(){this._unsub?.()}};async function H(t,i,a){t.innerHTML=`<div class="loading">${e("common.loading")}</div>`;try{switch(i){case"overview":await ve(t,a);break;case"matches":await me(t,{...a,refresh:()=>H(t,"matches",a),reload:()=>H(t,"matches",a)});break;case"reports":await O(t,a);break;case"teams":await pe(t,{...a,refresh:()=>H(t,"teams",a)});break;case"requests":await M(t,a);break;case"managers":await fe(t,a);break;case"settings":await _e(t,a);break;case"audit":await we(t,a);break}}catch(n){t.innerHTML="",t.append(F({message:e(n?.key??"errors.loadFailed"),retryLabel:e("common.retry"),onRetry:()=>H(t,i,a)}))}}async function ve(t,i){const[a,n]=await Promise.all([u.listTeams(),u.listMatches()]),s=ie(a.filter(o=>!o.archived),n);t.innerHTML=`
  <h2 class="section-title">${e("admin.overview.title")}</h2>
  <p class="page-subtitle">${e("admin.overview.subtitle")}</p>
  <div class="stat-grid">
    ${C(s.teamCount,e("stats.teams"))}
    ${C(s.totalMatches,e("stats.totalMatches"))}
    ${C(s.finishedCount,e("stats.finished"))}
    ${C(s.upcomingCount,e("stats.upcoming"))}
    ${C(s.liveCount,e("stats.live"),"stat-live")}
  </div>
  <div class="admin-quick">
    <a class="btn btn-primary" href="/admin/matches" data-link>⚽ ${e("admin.quick.addMatch")}</a>
    ${i.superAdmin?`<a class="btn btn-outline" href="/admin/teams" data-link>🛡️ ${e("admin.quick.addTeam")}</a>`:""}
  </div>`}function C(t,i,a=""){return`
  <div class="stat-card ${a}">
    <span class="stat-value">${t}</span>
    <span class="stat-label">${i}</span>
  </div>`}async function fe(t,i){const a=await u.listManagers();if(!a.length){t.innerHTML=`<h2 class="section-title">${e("admin.managers.title")}</h2>`,t.append(z({icon:"👤",message:e("admin.managers.empty")}));return}const n=a.map(s=>{const o=s.id===i.profile.id,d=[];return o||(s.role==="pending"&&d.push(`<button class="btn btn-primary btn-sm" data-role="score_manager" data-id="${s.id}" type="button">${e("admin.managers.promote")}</button>`),s.role==="score_manager"&&(d.push(`<button class="btn btn-ghost btn-sm" data-role="pending" data-id="${s.id}" type="button">${e("admin.managers.revoke")}</button>`),d.push(`<button class="btn btn-outline btn-sm" data-role="super_admin" data-id="${s.id}" type="button">${e("admin.managers.makeSuper")}</button>`)),s.role==="super_admin"&&d.push(`<button class="btn btn-danger-ghost btn-sm" data-role="score_manager" data-id="${s.id}" type="button">${e("admin.managers.demote")}</button>`)),`
      <div class="admin-row">
        <div class="admin-row-main">
          <span class="admin-row-teams">
            <strong>${m(s.display_name||s.email)}${o?` <em class="muted">${e("common.you")}</em>`:""}</strong>
            <span class="muted">${m(s.email)}</span>
          </span>
          <span class="admin-row-meta">${e("admin.managers.status")}: ${s.role==="pending"?e("admin.role.pending"):e("admin.managers.active")}</span>
        </div>
        <div class="admin-row-actions">
          <span class="tag tag-${s.role}">${e(`admin.role.${s.role}`)}</span>
          ${d.join("")}
        </div>
      </div>`}).join("");t.innerHTML=`
  <h2 class="section-title">${e("admin.managers.title")}</h2>
  <p class="page-subtitle">${e("admin.managers.subtitle")}</p>
  <div class="alert alert-info">${e("admin.managers.inviteHint")}</div>
  <div class="admin-team-list">${n}</div>

  <div class="panel">
    <h3 class="panel-title">${e("admin.managers.myProfile")}</h3>
    <div class="field">
      <label for="my-name">${e("admin.managers.displayName")}</label>
      <input id="my-name" type="text" maxlength="60" value="${m(i.profile.display_name??"")}" />
    </div>
    <div class="form-actions">
      <button id="save-profile" class="btn btn-primary" type="button">${e("admin.managers.saveProfile")}</button>
    </div>
  </div>`,t.querySelectorAll("[data-role]").forEach(s=>s.addEventListener("click",async()=>{const o=s.dataset.id,d=s.dataset.role;if(d==="super_admin"){const v=a.find(h=>h.id===o);if(!await I({title:e("common.confirm"),message:e("admin.managers.confirmSuper",{name:v?.display_name??v?.email??""}),confirmLabel:e("common.confirm"),cancelLabel:e("common.cancel")}))return}s.disabled=!0;try{await u.changeManagerRole(o,d),p(e("common.success")),await H(t,"managers",i)}catch(v){p(e(v?.key??"admin.errors.roleChange"),"error"),s.disabled=!1}})),t.querySelector("#save-profile").addEventListener("click",async s=>{const o=s.currentTarget;o.disabled=!0;try{const d=t.querySelector("#my-name").value.trim();await u.updateMyProfile({display_name:d}),p(e("admin.managers.profileSaved"))}catch(d){p(e(d?.key??"errors.saving"),"error")}finally{o.disabled=!1}})}async function O(t,i){const n=[...await u.listMatches()].sort((s,o)=>new Date(s.kickoff_at)-new Date(o.kickoff_at));t.innerHTML=`
    <h2 class="section-title">${e("admin.reports.title")}</h2>
    <p class="page-subtitle">${e("admin.reports.subtitle")}</p>
    <div class="admin-match-list">
      ${n.map(s=>`
        <div class="admin-match-row" data-match="${s.id}">
          <div class="admin-row-main">
            <span class="admin-row-teams"><strong>${m(s.home_team?.short_name||s.home_team_id)}</strong> vs <strong>${m(s.away_team?.short_name||s.away_team_id)}</strong></span>
            <span class="admin-row-meta">${m(s.round_name||"")} · ${m(D(s.kickoff_at))}</span>
          </div>
          <div class="admin-row-actions">
            <span class="tag tag-${s.status}">${e(`status.${s.status}`)}</span>
            ${s.status==="scheduled"?`<button class="btn btn-primary btn-sm" data-live="${s.id}" type="button">${e("admin.reports.markLive")}</button>`:""}
            ${s.status==="live"||s.status==="finished"?`<button class="btn btn-outline btn-sm" data-report="${s.id}" type="button">${e("admin.reports.openReport")}</button>`:""}
          </div>
        </div>`).join("")}
    </div>
    <div id="report-editor"></div>`,t.querySelectorAll("[data-live]").forEach(s=>{s.addEventListener("click",async()=>{try{await u.markMatchLive(s.dataset.live),p(e("admin.reports.markedLive"),"success"),await O(t,i)}catch(o){p(e(o?.key)||o?.message||"errors.generic","error")}})}),t.querySelectorAll("[data-report]").forEach(s=>{s.addEventListener("click",async()=>{const o={...i,refresh:()=>O(t,i)};await be(t.querySelector("#report-editor"),s.dataset.report,o)})})}async function be(t,i,a){const n=await u.getMatch(i),s=await u.getMatchEvents(i)||[],o=await u.getMatchReport(i);t.innerHTML=`
    <div class="panel report-editor">
      <h3 class="panel-title">${m(n.home_team?.short_name)} vs ${m(n.away_team?.short_name)}</h3>
      <p class="muted">${e("admin.reports.eventsHelp")}</p>
      <div id="events-list" class="events-list">
        ${s.map((d,v)=>V(d,v,n)).join("")}
      </div>
      <button id="add-event" class="btn btn-ghost btn-sm" type="button">+ ${e("admin.reports.addEvent")}</button>
      <div class="form-grid">
        <label>${e("admin.reports.summary")}<textarea id="rep-summary">${m(o?.summary||"")}</textarea></label>
        <label>${e("admin.reports.refereeHome")}<input id="rep-rh" type="number" value="${o?.referee_score_home??""}" /></label>
        <label>${e("admin.reports.refereeAway")}<input id="rep-ra" type="number" value="${o?.referee_score_away??""}" /></label>
      </div>
      <div class="form-actions">
        <button id="submit-report" class="btn btn-primary" type="button">${e("admin.reports.submit")}</button>
      </div>
      <div id="calc-preview" class="calc-preview"></div>
    </div>`,t.querySelector("#add-event").addEventListener("click",()=>{const d=t.querySelector("#events-list"),v=d.children.length;d.insertAdjacentHTML("beforeend",V({event_type:"goal",detail:"normal",minute:0,team_id:n.home_team_id,player_id:"",related_player_id:""},v,n))}),t.querySelector("#submit-report").addEventListener("click",async()=>{const d=ye(t),v=t.querySelector("#rep-summary").value,b=t.querySelector("#rep-rh").value,h=t.querySelector("#rep-ra").value;try{const $=await u.submitMatchReport({matchId:i,events:d,summary:v,refereeHome:b===""?null:Number(b),refereeAway:h===""?null:Number(h)});p(e("admin.reports.submitted",{score:`${$.homeScore}-${$.awayScore}`}),"success"),await a.refresh?.()}catch($){p(e($?.key)||$?.message||"errors.generic","error")}})}function V(t,i,a){const n=[a.home_team_id,a.away_team_id];return`<div class="event-row" data-idx="${i}">
    <select class="ev-type">
      <option value="goal" ${t.event_type==="goal"?"selected":""}>${e("event.goal")}</option>
      <option value="yellow" ${t.event_type==="yellow"?"selected":""}>${e("event.yellow")}</option>
      <option value="red" ${t.event_type==="red"?"selected":""}>${e("event.red")}</option>
      <option value="sub" ${t.event_type==="sub"?"selected":""}>${e("event.sub")}</option>
    </select>
    <select class="ev-detail">
      <option value="normal" ${t.detail==="normal"?"selected":""}>${e("event.normal")}</option>
      <option value="penalty" ${t.detail==="penalty"?"selected":""}>${e("event.penalty")}</option>
      <option value="own_goal" ${t.detail==="own_goal"?"selected":""}>${e("event.ownGoal")}</option>
    </select>
    <input class="ev-minute" type="number" min="0" max="130" value="${t.minute??0}" placeholder="${e("event.minute")}" />
    <input class="ev-extra" type="number" min="0" max="15" value="${t.extra_minute??""}" placeholder="+min" />
    <select class="ev-team">${n.map(s=>`<option value="${s}" ${t.team_id===s?"selected":""}>${s===a.home_team_id?a.home_team?.short_name||"H":a.away_team?.short_name||"A"}</option>`).join("")}</select>
    <input class="ev-player" type="text" value="${m(t.player_id||"")}" placeholder="${e("event.player")}" />
    <input class="ev-related" type="text" value="${m(t.related_player_id||"")}" placeholder="${e("event.assistOrIn")}" />
    <button class="btn btn-ghost btn-xs" data-remove type="button">✕</button>
  </div>`}function ye(t,i){const a=t.querySelectorAll(".event-row"),n=[];return a.forEach(s=>{n.push({event_type:s.querySelector(".ev-type").value,detail:s.querySelector(".ev-detail").value,minute:Number(s.querySelector(".ev-minute").value||0),extra_minute:s.querySelector(".ev-extra").value===""?null:Number(s.querySelector(".ev-extra").value),team_id:s.querySelector(".ev-team").value,player_id:s.querySelector(".ev-player").value.trim(),related_player_id:s.querySelector(".ev-related").value.trim()||null})}),t.querySelectorAll("[data-remove]").forEach(s=>{s.onclick=()=>s.closest(".event-row").remove()}),n}async function M(t,i){const[a,n,s]=await Promise.all([u.listStaffRequests(),u.listTeamCreationRequests(),u.listTransfers()]);t.innerHTML=`
    <h2 class="section-title">${e("admin.requests.title")}</h2>
    <section class="panel">
      <h3 class="panel-title">${e("admin.requests.staff")}</h3>
      ${he(a)}
    </section>
    <section class="panel">
      <h3 class="panel-title">${e("admin.requests.teamCreation")}</h3>
      ${$e(n)}
    </section>
    <section class="panel">
      <h3 class="panel-title">${e("admin.requests.transfers")}</h3>
      ${ge(s)}
    </section>`,t.querySelectorAll("[data-staff-approve]").forEach(o=>{o.addEventListener("click",async()=>{const d=o.dataset.role||"score_manager";try{await u.reviewStaffRequest(o.dataset.staffApprove,!0,d),p(e("common.success"),"success"),await M(t,i)}catch(v){p(v?.message||"errors.generic","error")}})}),t.querySelectorAll("[data-staff-reject]").forEach(o=>{o.addEventListener("click",async()=>{try{await u.reviewStaffRequest(o.dataset.staffReject,!1,null),await M(t,i)}catch(d){p(d?.message||"errors.generic","error")}})}),t.querySelectorAll("[data-team-approve]").forEach(o=>{o.addEventListener("click",async()=>{try{await u.approveTeamCreation(o.dataset.teamApprove,!0),p(e("common.success"),"success"),await M(t,i)}catch(d){p(d?.message||"errors.generic","error")}})}),t.querySelectorAll("[data-team-reject]").forEach(o=>{o.addEventListener("click",async()=>{try{await u.approveTeamCreation(o.dataset.teamReject,!1),await M(t,i)}catch(d){p(d?.message||"errors.generic","error")}})}),t.querySelectorAll("[data-transfer-approve]").forEach(o=>{o.addEventListener("click",async()=>{try{await u.finalizeTransfer(o.dataset.transferApprove,!0),p(e("common.success"),"success"),await M(t,i)}catch(d){p(d?.message||"errors.generic","error")}})}),t.querySelectorAll("[data-transfer-reject]").forEach(o=>{o.addEventListener("click",async()=>{try{await u.finalizeTransfer(o.dataset.transferReject,!1),await M(t,i)}catch(d){p(d?.message||"errors.generic","error")}})})}function he(t){const i=(t||[]).filter(a=>a.status==="pending");return i.length?`<div class="admin-team-list">${i.map(a=>`
    <div class="admin-row">
      <div class="admin-row-main">
        <span class="admin-row-teams"><strong>${m(a.user?.display_name||a.user_id)}</strong></span>
        <span class="admin-row-meta">${m(a.requested_task)} · ${m(a.description||"")}</span>
      </div>
      <div class="admin-row-actions">
        <button class="btn btn-primary btn-sm" data-staff-approve="${a.id}" data-role="score_manager" type="button">${e("common.approve")}</button>
        <button class="btn btn-ghost btn-sm" data-staff-reject="${a.id}" type="button">${e("common.reject")}</button>
      </div>
    </div>`).join("")}</div>`:`<p class="muted">${e("admin.requests.none")}</p>`}function $e(t){const i=(t||[]).filter(a=>a.status==="pending");return i.length?`<div class="admin-team-list">${i.map(a=>`
    <div class="admin-row">
      <div class="admin-row-main">
        <span class="admin-row-teams"><strong>${m(a.proposed_name)}</strong> (${m(a.short_name)})</span>
        <span class="admin-row-meta">${m(a.requester?.display_name||a.requester_id)}</span>
      </div>
      <div class="admin-row-actions">
        <button class="btn btn-primary btn-sm" data-team-approve="${a.id}" type="button">${e("common.approve")}</button>
        <button class="btn btn-ghost btn-sm" data-team-reject="${a.id}" type="button">${e("common.reject")}</button>
      </div>
    </div>`).join("")}</div>`:`<p class="muted">${e("admin.requests.none")}</p>`}function ge(t){const i=(t||[]).filter(a=>a.status==="captain_approved"||a.status==="pending");return i.length?`<div class="admin-team-list">${i.map(a=>`
    <div class="admin-row">
      <div class="admin-row-main">
        <span class="admin-row-teams">${m(a.player_id)} · ${m(a.from_team_id)} → ${m(a.to_team_id)}</span>
        <span class="admin-row-meta">${m(a.status)}</span>
      </div>
      <div class="admin-row-actions">
        <button class="btn btn-primary btn-sm" data-transfer-approve="${a.id}" type="button">${e("common.approve")}</button>
        <button class="btn btn-ghost btn-sm" data-transfer-reject="${a.id}" type="button">${e("common.reject")}</button>
      </div>
    </div>`).join("")}</div>`:`<p class="muted">${e("admin.requests.none")}</p>`}async function _e(t,i){if(!i.superAdmin){t.innerHTML=`<div class="alert alert-error">${e("admin.settings.superOnly")}</div>`;return}const a=await u.getSettings()??{};t.innerHTML=`
  <h2 class="section-title">${e("admin.settings.title")}</h2>
  <p class="page-subtitle">${e("admin.settings.subtitle")}</p>
  <form id="settings-form" class="panel form-grid" novalidate>
    <div class="field field-wide">
      <label for="s-name">${e("admin.form.tournamentName")}</label>
      <input id="s-name" type="text" maxlength="80" value="${m(a.tournament_name??"")}" />
    </div>
    <div class="field">
      <label for="s-season">${e("admin.form.seasonLabel")}</label>
      <input id="s-season" type="text" maxlength="40" value="${m(a.season_label??"")}" />
    </div>
    <div class="field">
      <label for="s-tz">${e("admin.form.timezone")}</label>
      <input id="s-tz" type="text" maxlength="40" value="${m(a.timezone??"Africa/Algiers")}" />
    </div>
    <div class="field">
      <label for="s-win">${e("admin.form.pointsWin")}</label>
      <input id="s-win" type="number" min="0" max="10" step="1" value="${a.points_for_win??3}" />
    </div>
    <div class="field">
      <label for="s-draw">${e("admin.form.pointsDraw")}</label>
      <input id="s-draw" type="number" min="0" max="10" step="1" value="${a.points_for_draw??1}" />
    </div>
    <div class="field">
      <label for="s-loss">${e("admin.form.pointsLoss")}</label>
      <input id="s-loss" type="number" min="0" max="10" step="1" value="${a.points_for_loss??0}" />
    </div>
    <div class="form-actions">
      <button class="btn btn-primary" type="submit">${e("common.save")}</button>
    </div>
    <div id="s-alert"></div>
  </form>`;const n=t.querySelector("#settings-form");let s=!1;n.addEventListener("submit",async o=>{if(o.preventDefault(),s)return;s=!0;const d=n.querySelector("button[type=submit]");d.disabled=!0,d.textContent=e("common.saving");const v=Number(n.querySelector("#s-win").value),b=Number(n.querySelector("#s-draw").value),h=Number(n.querySelector("#s-loss").value),$=n.querySelector("#s-name").value.trim(),l=n.querySelector("#s-season").value.trim(),r=n.querySelector("#s-tz").value.trim()||"Africa/Algiers",c=n.querySelector("#s-alert");if(!$||!Number.isInteger(v)||!Number.isInteger(b)||!Number.isInteger(h)){c.innerHTML=`<div class="alert alert-error">${e("errors.generic")}</div>`,s=!1,d.disabled=!1,d.textContent=e("common.save");return}try{await u.updateSettings({tournament_name:$,season_label:l,timezone:r,points_for_win:v,points_for_draw:b,points_for_loss:h}),ne(),await K(),p(e("admin.settings.saved"))}catch(y){c.innerHTML=`<div class="alert alert-error">${e(y?.key??"errors.saving")}</div>`}finally{s=!1,d.disabled=!1,d.textContent=e("common.save")}})}async function we(t){const i=await u.listAuditLogs(),a=i.map(n=>{const s=n.match,o=s?`${s.home_team?.short_name??"—"} – ${s.away_team?.short_name??"—"}`:n.match_id;let d="";const v=n.old_home_score!==n.new_home_score||n.old_away_score!==n.new_away_score,b=n.old_status!==n.new_status;return v&&(d+=`<span class="audit-score" dir="ltr">${n.old_home_score??"–"}:${n.old_away_score??"–"} → ${n.new_home_score??"–"}:${n.new_away_score??"–"}</span> `),b&&(d+=`<span class="tag">${e(`status.${n.old_status}`)} → ${e(`status.${n.new_status}`)}</span>`),`
      <div class="admin-row">
        <div class="admin-row-main">
          <span class="admin-row-teams"><strong>${m(o)}</strong></span>
          <span class="admin-row-meta">
            ${n.match?.kickoff_at?D(n.match.kickoff_at,j(),A())+" · ":""}
            ${e("admin.audit.changedBy")}: ${m(n.changer?.display_name||n.changer?.email||"—")}
          </span>
        </div>
        <div class="admin-row-actions">
          <span class="muted">${D(n.changed_at,j(),A())}</span>
          <span class="audit-change">${d}</span>
        </div>
      </div>`}).join("");t.innerHTML=`
  <h2 class="section-title">${e("admin.section.audit")}</h2>
  <p class="page-subtitle">${e("admin.audit.subtitle")}</p>
  ${i.length?`<div class="admin-team-list">${a}</div>`:z({icon:"🕘",message:e("admin.audit.empty")})}`}function ke(t,i){t.innerHTML="";const a=F({message:e(i?.key??"errors.dbConnection"),retryLabel:e("common.retry"),onRetry:()=>x("/admin")}),n=document.createElement("button");n.className="btn btn-ghost",n.type="button",n.textContent=e("auth.logout"),n.addEventListener("click",async()=>{await P(),x("/admin/login")}),a.append(n),t.append(a)}function Se(t,i){t.innerHTML=`
  <div class="auth-wrap">
    <div class="auth-card">
      <div class="auth-logo">🔒</div>
      <h1>${e("admin.noAccessTitle")}</h1>
      <p>${e("admin.noAccessMessage")}</p>
      <p class="muted">${m(i?.email??"")}</p>
      <div class="form-actions">
        <a class="btn btn-primary" href="/" data-link>${e("admin.backToSite")}</a>
        <a class="btn btn-outline" href="/my-team" data-link>${e("nav.myTeam")}</a>
        <button id="no-access-logout" class="btn btn-ghost" type="button">${e("auth.logout")}</button>
      </div>
    </div>
  </div>`,t.querySelector("#no-access-logout").addEventListener("click",async()=>{await P(),x("/")})}function qe(t,i){t.innerHTML=`
  <div class="auth-wrap">
    <div class="auth-card">
      <div class="auth-logo">⏳</div>
      <h1>${e("auth.pendingTitle")}</h1>
      <p>${e("auth.pendingMessage")}</p>
      <p class="muted">${m(i?.email??"")}</p>
      <div class="form-actions">
        <a class="btn btn-outline" href="/" data-link>${e("admin.backToSite")}</a>
        <button id="pending-logout" class="btn btn-ghost" type="button">${e("auth.logout")}</button>
      </div>
    </div>
  </div>`,t.querySelector("#pending-logout").addEventListener("click",async()=>{await P(),x("/")})}export{xe as default};
