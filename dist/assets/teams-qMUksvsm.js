import{d as c,b as d,t as a,g as i,e as l,c as m}from"./index-Bzu0St5_.js";import{d as o}from"./dataService-D6aeBORS.js";import{f as p}from"./dateFormat-g4eR_ppz.js";function g(e,{created:s=!1}={}){return`
  <a class="team-card" href="/teams/${e.id}" data-link>
    <div class="team-card-head">
      ${c(e,56,"team-logo team-logo-lg")}
      <div>
        <h3 class="team-card-name">${d(e.name)}</h3>
        <span class="team-card-short">${d(e.short_name??"")}</span>
      </div>
    </div>
    ${e.description?`<p class="team-card-desc">${d(e.description)}</p>`:""}
    ${s&&e.created_at?`<span class="team-card-created">${a("teams.created")} ${p(e.created_at,i(),"UTC")}</span>`:""}
  </a>`}const v={title:"page.teams",async render(e){let s;try{s=await o.listTeams()}catch(t){e.innerHTML="",e.append(l({message:a(t?.key??"errors.dbConnection"),retryLabel:a("common.retry"),onRetry:()=>this.render(e)}));return}const r=(s??[]).filter(t=>!t.archived),n=r.length?r.map(t=>g(t,{created:!0})).join(""):m({icon:"👕",message:a("teams.empty")});e.innerHTML=`
    <header class="page-header">
      <h1>${a("page.teams")}</h1>
      <p class="page-subtitle">${r.length?`${a("app.tagline")} · ${r.length}`:a("app.tagline")}</p>
    </header>
    <div class="card-grid teams-grid">${n}</div>`},destroy(){}};export{v as default};
