import{t as s,d as g,b as o}from"./index-Bzu0St5_.js";function p(a,{limit:n=0,compact:l=!1}={}){const d=n>0?a.slice(0,n):a,i=`
    <thead>
      <tr>
        <th class="col-pos" scope="col" title="${s("standings.position")}">#</th>
        <th class="col-team" scope="col">${s("standings.team")}</th>
        <th scope="col" title="${s("standings.playedFull")}">${s("standings.played")}</th>
        <th scope="col" title="${s("standings.winsFull")}">${s("standings.wins")}</th>
        <th scope="col" title="${s("standings.drawsFull")}">${s("standings.draws")}</th>
        <th scope="col" title="${s("standings.lossesFull")}">${s("standings.losses")}</th>
        ${l?"":`<th scope="col" title="${s("standings.goalsForFull")}">${s("standings.goalsFor")}</th>`}
        ${l?"":`<th scope="col" title="${s("standings.goalsAgainstFull")}">${s("standings.goalsAgainst")}</th>`}
        <th scope="col" title="${s("standings.goalDiffFull")}">${s("standings.goalDiff")}</th>
        <th class="col-pts" scope="col" title="${s("standings.pointsFull")}">${s("standings.points")}</th>
      </tr>
    </thead>`,e=d.map(t=>{const c=t.goal_diff>0?`+${t.goal_diff}`:String(t.goal_diff);return`
      <tr>
        <td class="col-pos"><span class="pos-chip pos-${t.position<=2?"top":""}">${t.position}</span></td>
        <td class="col-team">
          <span class="team-cell">
            ${g(t,26,"team-logo team-logo-xs")}
            <span class="team-cell-name">${o(t.name)}</span>
            <span class="team-cell-short">${o(t.short_name??"")}</span>
          </span>
        </td>
        <td>${t.played}</td>
        <td>${t.won}</td>
        <td>${t.drawn}</td>
        <td>${t.lost}</td>
        ${l?"":`<td>${t.goals_for}</td>`}
        ${l?"":`<td>${t.goals_against}</td>`}
        <td class="col-gd">${c}</td>
        <td class="col-pts"><strong>${t.points}</strong></td>
      </tr>`}).join("");return`
  <div class="table-scroll">
    <table class="standings-table ${l?"standings-compact":""}">
      <caption class="visually-hidden">${s("page.standings")}</caption>
      ${i}
      <tbody>${e}</tbody>
    </table>
  </div>`}export{p as s};
