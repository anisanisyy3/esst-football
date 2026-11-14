import{e as d,t as i,c as m,b as h,g as p}from"./index-Bzu0St5_.js";import{s as u,d as f}from"./dataService-D6aeBORS.js";import{l as g}from"./settingsCache-Cu85K49s.js";import{m as y}from"./matchCard-CpERVok9.js";import{f as b}from"./dateFormat-g4eR_ppz.js";const k=[{id:"all",key:"matches.filter.all"},{id:"upcoming",key:"matches.filter.upcoming"},{id:"live",key:"matches.filter.live"},{id:"finished",key:"matches.filter.finished"},{id:"postponed",key:"matches.filter.postponed"}],S={title:"page.matches",async render(e){await g();let r;try{r=await o()}catch(a){e.innerHTML="",e.append(d({message:i(a?.key??"errors.dbConnection"),retryLabel:i("common.retry"),onRetry:()=>this.render(e)}));return}e.innerHTML=`
      <header class="page-header">
        <h1>${i("page.matches")}</h1>
        <p class="page-subtitle">${i("app.name")}</p>
      </header>
      <div class="filter-chips" role="tablist" aria-label="${i("nav.matches")}">
        ${k.map(a=>`<button class="chip" data-filter="${a.id}" type="button">${i(a.key)}</button>`).join("")}
      </div>
      <div id="matches-list" class="matches-groups"></div>
    `;let c="all";const n=e.querySelector("#matches-list"),s=[...e.querySelectorAll(".chip")],t=()=>{s.forEach(a=>a.classList.toggle("chip-active",a.dataset.filter===c)),n.innerHTML=L(r.matches,c)};s.forEach(a=>a.addEventListener("click",()=>{c=a.dataset.filter,t()})),t();let l=null;this._unsub=u(()=>{clearTimeout(l),l=setTimeout(async()=>{try{r=await o(),t()}catch{}},250)})},destroy(){this._unsub?.()}};async function o(){return{matches:await f.listMatches()}}function v(e,r){switch(r){case"upcoming":return e.status==="scheduled";case"live":return e.status==="live";case"finished":return e.status==="finished";case"postponed":return e.status==="postponed";default:return!0}}function L(e,r){const c=e.filter(s=>v(s,r));if(!c.length)return m({icon:"📅",message:e.length?i("matches.empty"):i("matches.emptyAll")});const n=new Map;for(const s of c.sort((t,l)=>t.kickoff_at.localeCompare(l.kickoff_at))){const t=(s.kickoff_at??"").slice(0,10);n.has(t)||n.set(t,[]),n.get(t).push(s)}return[...n.entries()].map(([s,t])=>`
      <section class="match-group">
        <h2 class="match-group-title">${h(b(`${s}T12:00:00Z`,p(),"UTC"))}</h2>
        <div class="card-grid">${t.map(l=>y(l)).join("")}</div>
      </section>`).join("")}export{S as default};
