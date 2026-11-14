import{e as m,t as s,b as i,c as $}from"./index-Bzu0St5_.js";import{s as v,d}from"./dataService-D6aeBORS.js";import{l as u,g as f}from"./settingsCache-Cu85K49s.js";import{c as b}from"./standings-L4P47zG5.js";import{c as g}from"./stats-CiPQW6v9.js";const S={title:"page.statistics",async render(a){await u();let n;try{n=await p()}catch(e){a.innerHTML="",a.append(m({message:s(e?.key??"errors.dbConnection"),retryLabel:s("common.retry"),onRetry:()=>this.render(a)}));return}const l=({teams:e,matches:r})=>{const t=g(e,r),o=b(e,r,f())[0]??null,h=t.finishedCount>0;a.innerHTML=`
      <header class="page-header">
        <h1>${s("page.statistics")}</h1>
        <p class="page-subtitle">${s("app.name")}</p>
      </header>

      <div class="stat-grid">
        ${c(t.teamCount,s("stats.teams"))}
        ${c(t.totalMatches,s("stats.totalMatches"))}
        ${c(t.finishedCount,s("stats.finished"))}
        ${c(t.upcomingCount,s("stats.upcoming"))}
        ${c(t.liveCount,s("stats.live"))}
        ${c(t.postponedCount,s("stats.postponed"))}
      </div>

      ${h?`
          <section class="section">
            <h2 class="section-title">${s("stats.totalGoals")}</h2>
            <div class="stat-grid">
              ${c(t.totalGoals,s("stats.totalGoals"))}
              ${c(t.avgGoals??"—",s("stats.avgGoals"))}
            </div>
          </section>

          <section class="section">
            <h2 class="section-title">${s("stats.bestAttack")} / ${s("stats.bestDefense")}</h2>
            <div class="stat-grid">
              <div class="stat-card stat-accent">
                <span class="stat-value">${i(t.bestAttack?.team?.short_name??"—")}</span>
                <span class="stat-label">${s("stats.bestAttack")} · ${t.bestAttack?.goals??0}</span>
              </div>
              <div class="stat-card stat-accent">
                <span class="stat-value">${i(t.bestDefense?.team?.short_name??"—")}</span>
                <span class="stat-label">${s("stats.bestDefense")} · ${t.bestDefense?.goalsAgainst??0}</span>
              </div>
              <div class="stat-card stat-accent">
                <span class="stat-value">${i(t.bestDiff?.team?.short_name??"—")}</span>
                <span class="stat-label">${s("stats.bestDiff")} · ${t.bestDiff&&t.bestDiff.diff>0?"+":""}${t.bestDiff?.diff??0}</span>
              </div>
              ${o?`<div class="stat-card stat-accent">
                      <span class="stat-value">${o.position}</span>
                      <span class="stat-label">${i(o.name)} · ${o.points}</span>
                    </div>`:""}
            </div>
          </section>

          ${y(t.goalsByTeam)}`:$({icon:"📊",message:s("stats.emptyResults")})}

      <p class="coming-soon">🚧 ${s("stats.playersSoon")}</p>`};l(n),this._unsub=v(async()=>{try{l(await p())}catch{}})},destroy(){this._unsub?.()}};async function p(){const[a,n]=await Promise.all([d.listTeams(),d.listMatches()]);return{teams:a,matches:n}}function c(a,n){return`
  <div class="stat-card">
    <span class="stat-value">${a}</span>
    <span class="stat-label">${n}</span>
  </div>`}function y(a){if(!a.length)return"";const n=Math.max(...a.map(e=>e.goals),1),l=a.map(e=>`
      <div class="chart-row">
        <span class="chart-label">${i(e.short_name||e.name)}</span>
        <div class="chart-track">
          <div class="chart-bar" style="width:${Math.round(e.goals/n*100)}%"></div>
        </div>
        <span class="chart-value">${e.goals}</span>
      </div>`).join("");return`
  <section class="section">
    <h2 class="section-title">${s("stats.chartGoals")}</h2>
    <div class="chart-card">${l}</div>
  </section>`}export{S as default};
