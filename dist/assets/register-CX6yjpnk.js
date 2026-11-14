import{b as r,t as e,P as n,l as s,u as p,s as o,n as m}from"./index-Bzu0St5_.js";import"./dataService-D6aeBORS.js";const d={goalkeeper:"positions.goalkeeper",defender:"positions.defender",midfielder:"positions.midfielder",forward:"positions.forward"},u=["right","left","both"],b={title:"page.register",async render(i){i.innerHTML=`
      <section class="page-header"><h1>${r(e("auth.registerTitle"))}</h1><p class="page-sub">${r(e("auth.registerSubtitle"))}</p></section>
      <div class="card form-card">
        <form id="reg-form" class="form-grid">
          <label>${e("auth.email")}<input type="email" name="email" required /></label>
          <label>${e("auth.password")}<input type="password" name="password" required minlength="6" /></label>
          <label>${e("profile.fullName")}<input type="text" name="full_name" required /></label>
          <label>${e("profile.birthYear")}<input type="number" name="birth_year" min="1950" max="2020" required /></label>
          <label>${e("profile.mainPosition")}<select name="main_position" required>
            ${n.map(a=>`<option value="${a}">${e(d[a])}</option>`).join("")}
          </select></label>
          <label>${e("profile.preferredFoot")}<select name="preferred_foot" required>
            ${u.map(a=>`<option value="${a}">${e(`foot.${a}`)}</option>`).join("")}
          </select></label>
          <label>${e("profile.nickname")}<input type="text" name="nickname" /></label>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">${e("auth.register")}</button>
          </div>
        </form>
        <p class="form-hint">${r(e("auth.haveAccount"))} <a href="/admin/login" data-link>${e("nav.login")}</a></p>
      </div>`,i.querySelector("#reg-form").addEventListener("submit",async a=>{a.preventDefault();const t=new FormData(a.target);try{const l=await s({email:t.get("email"),password:t.get("password"),displayName:t.get("full_name")});await p({full_name:t.get("full_name"),birth_year:Number(t.get("birth_year")),main_position:t.get("main_position"),preferred_foot:t.get("preferred_foot"),nickname:t.get("nickname")||null,profile_complete:!0}),o(e("auth.registerSuccess"),"success"),m("/profile")}catch(l){o(e(l.key||"errors.generic"),"error")}})}};export{b as default};
