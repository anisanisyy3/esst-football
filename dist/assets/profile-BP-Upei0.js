import{f as m,b as l,t as e,h as u,P as r,u as c,s as n}from"./index-Bzu0St5_.js";import"./dataService-D6aeBORS.js";const s={goalkeeper:"positions.goalkeeper",defender:"positions.defender",midfielder:"positions.midfielder",forward:"positions.forward"},f=["right","left","both"],h={title:"page.profile",async render(a){if(!await m()){a.innerHTML=`<p>${l(e("auth.signInRequired"))}</p><a href="/admin/login" data-link class="btn btn-primary">${e("nav.login")}</a>`;return}const o=await u();a.innerHTML=`
      <section class="page-header"><h1>${l(e("profile.title"))}</h1></section>
      <div class="card form-card">
        <form id="pf" class="form-grid">
          <label>${e("profile.fullName")}<input type="text" name="full_name" value="${l(o.full_name||"")}" required /></label>
          <label>${e("profile.birthYear")}<input type="number" name="birth_year" value="${o.birth_year||""}" min="1950" max="2020" /></label>
          <label>${e("profile.mainPosition")}<select name="main_position">
            ${r.map(t=>`<option value="${t}" ${o.main_position===t?"selected":""}>${e(s[t])}</option>`).join("")}
          </select></label>
          <label>${e("profile.secondaryPosition")}<select name="secondary_position">
            <option value="">—</option>
            ${r.map(t=>`<option value="${t}" ${o.secondary_position===t?"selected":""}>${e(s[t])}</option>`).join("")}
          </select></label>
          <label>${e("profile.preferredFoot")}<select name="preferred_foot">
            ${f.map(t=>`<option value="${t}" ${o.preferred_foot===t?"selected":""}>${e(`foot.${t}`)}</option>`).join("")}
          </select></label>
          <label>${e("profile.height")}<input type="number" name="height_cm" value="${o.height_cm||""}" min="120" max="230" /></label>
          <label>${e("profile.weight")}<input type="number" name="weight_kg" value="${o.weight_kg||""}" min="30" max="160" /></label>
          <label>${e("profile.nickname")}<input type="text" name="nickname" value="${l(o.nickname||"")}" /></label>
          <label>${e("profile.photoUrl")}<input type="url" name="photo_url" value="${l(o.photo_url||"")}" /></label>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">${e("common.save")}</button>
          </div>
        </form>
        <p class="muted">${e("profile.ovr")}: <strong>${o.ovr??60}</strong> · ${e("profile.role")}: ${l(o.role)}</p>
      </div>`,a.querySelector("#pf").addEventListener("submit",async t=>{t.preventDefault();const i=new FormData(t.target);try{await c({full_name:i.get("full_name"),birth_year:i.get("birth_year")?Number(i.get("birth_year")):null,main_position:i.get("main_position"),secondary_position:i.get("secondary_position")||null,preferred_foot:i.get("preferred_foot"),height_cm:i.get("height_cm")?Number(i.get("height_cm")):null,weight_kg:i.get("weight_kg")?Number(i.get("weight_kg")):null,nickname:i.get("nickname")||null,photo_url:i.get("photo_url")||null,profile_complete:!0}),n(e("profile.saved"),"success")}catch(p){n(e(p.key||"errors.generic"),"error")}})}};export{h as default};
