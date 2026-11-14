import{e as $,t,a as y,b as d,c as p}from"./index-Bzu0St5_.js";import{s as k,d as m}from"./dataService-D6aeBORS.js";import{l as C,g as _}from"./settingsCache-Cu85K49s.js";import{c as M}from"./standings-L4P47zG5.js";import{c as S}from"./stats-CiPQW6v9.js";import{m as T}from"./matchCard-CpERVok9.js";import{s as w}from"./standingsTable-DLmXX4jw.js";import"./dateFormat-g4eR_ppz.js";const q={title:"page.home",async render(s){await C();let e;try{e=await h()}catch(n){H(s,n);return}u(s,e);let a=null;this._unsub=k(()=>{clearTimeout(a),a=setTimeout(async()=>{try{u(s,await h())}catch{}},250)})},destroy(){this._unsub?.()}};async function h(){const[s,e]=await Promise.all([m.listTeams(),m.listMatches()]);return{teams:s,matches:e,settings:_()}}function H(s,e){s.innerHTML="",s.append($({message:t(e?.key??"errors.dbConnection"),retryLabel:t("common.retry"),onRetry:()=>this.render(s)}))}function u(s,{teams:e,matches:a,settings:n}){const v=a.filter(i=>i.status==="live"),f=a.filter(i=>i.status==="scheduled").sort((i,c)=>i.kickoff_at.localeCompare(c.kickoff_at)).slice(0,4),g=a.filter(i=>i.status==="finished").sort((i,c)=>c.kickoff_at.localeCompare(i.kickoff_at)).slice(0,4),b=M(e,a,n),l=S(e,a);s.innerHTML=`
  <section class="hero">
    <div class="hero-inner">
      <span class="hero-badge">${y(20)} ${t("home.heroBadge")}${n.season_label?` · ${d(n.season_label)}`:""}</span>
      <h1 class="hero-title">${d(n.tournament_name||t("app.name"))}</h1>
      <p class="hero-subtitle">${t("home.heroSubtitle")}</p>
      <div class="hero-actions">
        <a class="btn btn-primary btn-lg" href="/matches" data-link>${t("home.ctaMatches")}</a>
        <a class="btn btn-outline btn-lg" href="/standings" data-link>${t("home.ctaStandings")}</a>
      </div>
    </div>
  </section>

  <section class="section" aria-labelledby="live-title">
    <h2 class="section-title" id="live-title"><span class="live-dot"></span> ${t("home.live.title")}</h2>
    <div id="live-slot">${r(v,"live")}</div>
  </section>

  <section class="section" aria-labelledby="upcoming-title">
    <div class="section-head">
      <h2 class="section-title" id="upcoming-title">${t("home.upcoming.title")}</h2>
      <a class="section-link" href="/matches" data-link>${t("nav.matches")} →</a>
    </div>
    <div class="card-grid">${r(f,"upcoming")}</div>
  </section>

  <section class="section" aria-labelledby="results-title">
    <div class="section-head">
      <h2 class="section-title" id="results-title">${t("home.results.title")}</h2>
      <a class="section-link" href="/matches" data-link>${t("nav.matches")} →</a>
    </div>
    <div class="card-grid">${r(g,"results")}</div>
  </section>

  <section class="section" aria-labelledby="standings-title">
    <div class="section-head">
      <h2 class="section-title" id="standings-title">${t("home.standings.title")}</h2>
      <a class="section-link" href="/standings" data-link>${t("home.standings.viewAll")} →</a>
    </div>
    <div id="standings-slot">${L(b)}</div>
  </section>

  <section class="section" aria-labelledby="stats-title">
    <h2 class="section-title" id="stats-title">${t("home.stats.title")}</h2>
    <div class="stat-grid">
      ${o(l.teamCount,t("home.stats.teams"))}
      ${o(l.totalMatches,t("home.stats.matches"))}
      ${o(l.finishedCount,t("home.stats.finished"))}
      ${o(l.upcomingCount,t("home.stats.upcoming"))}
    </div>
  </section>`}function r(s,e){if(!s.length){const a=e==="live"?t("home.live.empty"):e==="upcoming"?t("home.upcoming.empty"):t("home.results.empty");return p({icon:e==="live"?"📡":e==="upcoming"?"📅":"🏁",message:a})}return s.map(a=>T(a)).join("")}function L(s){return s.some(a=>a.played>0)?w(s,{limit:4,compact:!0}):p({icon:"🏆",message:t("home.standings.empty")})}function o(s,e){return`
  <div class="stat-card">
    <span class="stat-value">${s}</span>
    <span class="stat-label">${e}</span>
  </div>`}export{q as default};
