import{e as _,t as s,c as b,b as e,d as p,g as i}from"./index-Bzu0St5_.js";import{d as u,s as f}from"./dataService-D6aeBORS.js";import{l as y,a as v}from"./settingsCache-Cu85K49s.js";import{s as g}from"./matchCard-CpERVok9.js";import{a as $,b as h}from"./dateFormat-g4eR_ppz.js";const D={title:"page.matchDetails",async render(o,n){await y();const c=a=>{if(!a){o.innerHTML="",o.append(b({icon:"🔍",message:s("matchDetails.empty")}));return}const d=a.home_team,t=a.away_team,l=a.home_score!==null&&a.away_score!==null,m=l&&a.status==="finished"?a.home_score>a.away_score?d?.name:a.away_score>a.home_score?t?.name:null:null;o.innerHTML=`
      <nav class="breadcrumbs"><a href="/matches" data-link>← ${s("matchDetails.backToMatches")}</a></nav>
      <article class="match-detail">
        <div class="match-detail-top">
          ${a.round_name?`<span class="match-round">${e(a.round_name)}</span>`:""}
          ${g(a.status)}
        </div>
        <div class="scoreboard" dir="ltr">
          <div class="scoreboard-team">
            ${p(d,64,"team-logo team-logo-xl")}
            <span class="scoreboard-name">${e(d?.name??"—")}</span>
            <span class="scoreboard-short">${e(d?.short_name??"")}</span>
          </div>
          <div class="scoreboard-center">
            ${l?`<span class="scoreboard-score">${a.home_score} – ${a.away_score}</span>`:`<span class="scoreboard-time">${$(a.kickoff_at,i(),v())}</span>`}
            ${m?`<span class="scoreboard-winner">🏆 ${e(m)}</span>`:""}
          </div>
          <div class="scoreboard-team">
            ${p(t,64,"team-logo team-logo-xl")}
            <span class="scoreboard-name">${e(t?.name??"—")}</span>
            <span class="scoreboard-short">${e(t?.short_name??"")}</span>
          </div>
        </div>
        <dl class="match-info-grid">
          <div><dt>${s("match.kickoff")}</dt><dd>${$(a.kickoff_at,i(),window.__tz)}</dd></div>
          <div><dt>${s("match.venue")}</dt><dd>${a.venue?e(a.venue):"—"}</dd></div>
          <div><dt>${s("match.round")}</dt><dd>${a.round_name?e(a.round_name):"—"}</dd></div>
          <div><dt>${s("common.updatedAt")}</dt><dd>${h(a.updated_at,i(),v())}</dd></div>
        </dl>
      </article>`};let r;try{r=await u.getMatch(n.id)}catch(a){o.innerHTML="",o.append(_({message:s(a?.key??"errors.dbConnection"),retryLabel:s("common.retry"),onRetry:()=>this.render(o,n)}));return}c(r),this._unsub=f(async()=>{try{const a=await u.getMatch(n.id);a&&(r=a,c(r))}catch{}})},destroy(){this._unsub?.()}};export{D as default};
