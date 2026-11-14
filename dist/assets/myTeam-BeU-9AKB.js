import{f as h,h as b,i as $,b as a,t,j as g,s as c}from"./index-Bzu0St5_.js";import{d as s}from"./dataService-D6aeBORS.js";const _={title:"page.myTeam",async render(r){const m=await h(),d=m?await b().catch(()=>null):null;if(!$(d)){r.innerHTML=`<div class="empty-state"><p>${a(t("players.membersOnly"))}</p><a href="/admin/login" data-link class="btn btn-primary">${t("nav.login")}</a></div>`;return}const i=await s.myMembership();if(!i){r.innerHTML=`
        <section class="page-header"><h1>${a(t("myTeam.title"))}</h1></section>
        <div class="empty-state"><p>${a(t("myTeam.noTeam"))}</p>
        <a href="/teams" data-link class="btn btn-primary">${t("teams.browse")}</a></div>`;return}const p=await s.getTeam(i.team_id),y=await s.listTeamMemberships(i.team_id),u=await s.listTeamPosts(i.team_id),l=i.role_in_team==="captain"||g(d);let o=[];l&&(o=await s.listJoinRequests(i.team_id)),r.innerHTML=`
      <section class="page-header"><h1>${a(p.name)}</h1><p class="page-sub">${a(t("myTeam.privateSpace"))}</p></section>
      <div class="grid-2">
        <div class="card">
          <h3>${a(t("myTeam.roster"))}</h3>
          <ul class="roster-list">
            ${y.map(e=>`<li>
              <span class="jersey">${e.jersey_number??"—"}</span>
              <span>${a(e.player?.display_name||e.player_id)}</span>
              ${e.role_in_team==="captain"?`<span class="badge badge-captain">${t("team.captain")}</span>`:""}
            </li>`).join("")}
          </ul>
        </div>
        <div class="card">
          <h3>${a(t("myTeam.posts"))}</h3>
          <form id="post-form" class="form-grid">
            <input type="text" name="title" placeholder="${a(t("myTeam.postTitle"))}" />
            <textarea name="body" placeholder="${a(t("myTeam.postBody"))}" required></textarea>
            <button type="submit" class="btn btn-primary btn-sm">${t("myTeam.publish")}</button>
          </form>
          <div class="post-list">
            ${u.map(e=>`<article class="post">
              <header><strong>${a(e.author?.display_name||"")}</strong> <span class="muted">${a(e.created_at)}</span>
              ${e.author_id===m.user.id||l?`<button class="btn btn-ghost btn-xs" data-del="${e.id}">${t("common.delete")}</button>`:""}</header>
              ${e.title?`<h4>${a(e.title)}</h4>`:""}
              <p>${a(e.body)}</p>
            </article>`).join("")||`<p class="muted">${a(t("myTeam.noPosts"))}</p>`}
          </div>
        </div>
      </div>
      ${l?`
      <section class="section"><h2 class="section-title">${a(t("myTeam.joinRequests"))}</h2>
        <div class="table-wrap"><table class="standings-table"><thead><tr><th>${t("players.title")}</th><th>${t("myTeam.message")}</th><th>${t("common.actions")}</th></tr></thead><tbody>
          ${o.filter(e=>e.status==="pending").map(e=>`<tr>
            <td>${a(e.player?.display_name||e.player_id)}</td>
            <td>${a(e.message||"")}</td>
            <td>
              <button class="btn btn-primary btn-xs" data-accept="${e.id}">${t("common.accept")}</button>
              <button class="btn btn-ghost btn-xs" data-reject="${e.id}">${t("common.reject")}</button>
            </td>
          </tr>`).join("")||`<tr><td colspan="3" class="muted">${a(t("myTeam.noRequests"))}</td></tr>`}
        </tbody></table></div>
      </section>`:""}`,r.querySelector("#post-form")?.addEventListener("submit",async e=>{e.preventDefault();const n=new FormData(e.target);try{await s.addTeamPost(i.team_id,n.get("title"),n.get("body"),"post"),c(t("myTeam.posted"),"success"),navigate("/my-team",{replace:!0})}catch{c(t("errors.generic"),"error")}}),r.querySelectorAll("[data-del]").forEach(e=>{e.addEventListener("click",async()=>{try{await s.deleteTeamPost(e.dataset.del),navigate("/my-team",{replace:!0})}catch{c(t("errors.generic"),"error")}})}),r.querySelectorAll("[data-accept]").forEach(e=>{e.addEventListener("click",async()=>{try{await s.decideJoinRequest(e.dataset.accept,!0,null),c(t("myTeam.accepted"),"success"),navigate("/my-team",{replace:!0})}catch(n){c(t(n?.message||"errors.generic"),"error")}})}),r.querySelectorAll("[data-reject]").forEach(e=>{e.addEventListener("click",async()=>{try{await s.decideJoinRequest(e.dataset.reject,!1,null),navigate("/my-team",{replace:!0})}catch{c(t("errors.generic"),"error")}})})}};export{_ as default};
