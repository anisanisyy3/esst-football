import{e as $,t as a,c as g,d as u,b as d}from"./index-Bzu0St5_.js";import{d as p}from"./dataService-D6aeBORS.js";import{l as _,g as v}from"./settingsCache-Cu85K49s.js";import{c as y}from"./standings-L4P47zG5.js";import{m as b}from"./matchCard-CpERVok9.js";import"./dateFormat-g4eR_ppz.js";const x={title:"page.teamDetails",async render(i,n){await _();let o,r,e;try{[o,r]=await Promise.all([p.listTeams(),p.listMatches()]),e=o.find(s=>s.id===n.id)??null}catch(s){i.innerHTML="",i.append($({message:a(s?.key??"errors.dbConnection"),retryLabel:a("common.retry"),onRetry:()=>this.render(i,n)}));return}if(!e){i.innerHTML="",i.append(g({icon:"🔍",message:a("teamDetails.empty")}));return}const c=y(o,r,v()),t=c.find(s=>s.team_id===e.id)??{position:"—",played:0,won:0,drawn:0,lost:0,goals_for:0,goals_against:0,goal_diff:0,points:0},m=r.filter(s=>s.home_team_id===e.id||s.away_team_id===e.id).sort((s,h)=>h.kickoff_at.localeCompare(s.kickoff_at)),f=t.goal_diff>0?`+${t.goal_diff}`:String(t.goal_diff);i.innerHTML=`
    <nav class="breadcrumbs"><a href="/teams" data-link>← ${a("teamDetails.backToTeams")}</a></nav>
    <header class="team-hero">
      ${u(e,84,"team-logo team-logo-xl")}
      <div>
        <h1>${d(e.name)}</h1>
        <span class="team-hero-short">${d(e.short_name??"")}</span>
        ${e.description?`<p class="team-hero-desc">${d(e.description)}</p>`:""}
      </div>
    </header>

    <section class="section" aria-labelledby="team-stats-title">
      <h2 class="section-title" id="team-stats-title">${a("teamDetails.recordTitle")}</h2>
      <div class="stat-grid">
        <div class="stat-card stat-accent">
          <span class="stat-value">${t.position}</span>
          <span class="stat-label">${a("teamDetails.position")} <small>${a("teamDetails.positionOf",{total:c.length})}</small></span>
        </div>
        ${l(t.points,a("standings.pointsFull"))}
        ${l(t.played,a("standings.playedFull"))}
        ${l(t.won,a("standings.winsFull"))}
        ${l(t.drawn,a("standings.drawsFull"))}
        ${l(t.lost,a("standings.lossesFull"))}
        ${l(t.goals_for,a("standings.goalsForFull"))}
        ${l(t.goals_against,a("standings.goalsAgainstFull"))}
        ${l(f,a("standings.goalDiffFull"))}
      </div>
    </section>

    <section class="section" aria-labelledby="team-fixtures-title">
      <h2 class="section-title" id="team-fixtures-title">${a("teamDetails.fixturesTitle")}</h2>
      <div class="card-grid">
        ${m.length?m.map(s=>b(s)).join(""):g({icon:"📅",message:a("teamDetails.noMatches")})}
      </div>
    </section>`},destroy(){}};function l(i,n){return`
  <div class="stat-card">
    <span class="stat-value">${i}</span>
    <span class="stat-label">${n}</span>
  </div>`}export{x as default};
