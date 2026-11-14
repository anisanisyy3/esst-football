import{b as e,t as i,d as m,g as o}from"./index-Bzu0St5_.js";import{a as p,r as $,c as u}from"./dateFormat-g4eR_ppz.js";import{a as r}from"./settingsCache-Cu85K49s.js";function f(a,n=""){return`<span class="badge badge-${a} ${n}">
    ${a==="live"?'<span class="live-dot" aria-hidden="true"></span>':""}
    ${i(`status.${a}`)}
  </span>`}function v(a,{compact:n=!1}={}){if(a.status==="live"||a.status==="finished"){const s=a.home_score!==null&&a.away_score!==null;return`<span class="score${n?" score-sm":""}" dir="ltr">${s?`${a.home_score} – ${a.away_score}`:"– : –"}</span>`}if(a.status==="scheduled"||a.status==="postponed"){const{labelKey:s,time:t}=$(a.kickoff_at,o(),r());return s?`<span class="match-when">${i(s)} · ${t}</span>`:`<span class="match-when">${u(a.kickoff_at,o(),r())}</span>`}return'<span class="match-when">—</span>'}function k(a,{showVenue:n=!0,showRound:s=!0}={}){const t=a.home_team,c=a.away_team,l=t?.name??"—",d=c?.name??"—";return`
  <article class="match-card${a.status==="live"?" match-live":""}">
    <div class="match-card-top">
      ${s&&a.round_name?`<span class="match-round">${e(a.round_name)}</span>`:"<span></span>"}
      ${f(a.status)}
    </div>
    <a class="match-card-body" href="/matches/${a.id}" data-link
       aria-label="${e(l)} ${i("match.vs")} ${e(d)}">
      <div class="match-side">
        ${m(t,36,"team-logo team-logo-sm")}
        <span class="match-team-name">${e(l)}</span>
      </div>
      <div class="match-middle">
        ${v(a)}
      </div>
      <div class="match-side match-side-right">
        <span class="match-team-name">${e(d)}</span>
        ${m(c,36,"team-logo team-logo-sm")}
      </div>
    </a>
    <div class="match-card-foot">
      <span>${p(a.kickoff_at,o(),r())}</span>
      ${n&&a.venue?`<span>📍 ${e(a.venue)}</span>`:""}
    </div>
  </article>`}export{k as m,f as s};
