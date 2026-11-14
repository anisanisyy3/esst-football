import{f as h,n as u,a as y,t as e,o as f,p as r,q as w,r as L,s as k}from"./index-Bzu0St5_.js";const M={title:"page.adminLogin",async render(s){if(await h()){u("/admin",{replace:!0});return}s.innerHTML=`
    <div class="auth-wrap">
      <div class="auth-card">
        <div class="auth-logo">${y(56)}</div>
        <h1>${e("page.adminLogin")}</h1>
        <p class="auth-note">${e("auth.inviteNote")}</p>
        <div id="auth-alert"></div>
        <div id="auth-body"></div>
      </div>
    </div>`;const b=s.querySelector("#auth-alert"),m=s.querySelector("#auth-body"),c=(i,n="error")=>{b.innerHTML=`<div class="alert alert-${n}" role="alert">${i}</div>`};if(f){const i=r("div",{class:"alert alert-info"},e("demo.authNotice")),n=r("button",{class:"btn btn-primary btn-block",type:"button"},e("demo.enterAsSuper")),l=r("button",{class:"btn btn-outline btn-block",type:"button"},e("demo.enterAsManager")),a=r("button",{class:"btn btn-outline btn-block",type:"button"},e("demo.enterAsCaptain")),v=r("button",{class:"btn btn-ghost btn-block",type:"button"},e("demo.enterAsMember"));n.addEventListener("click",()=>d("super_admin")),l.addEventListener("click",()=>d("score_manager")),a.addEventListener("click",()=>d("captain")),v.addEventListener("click",()=>d("member")),m.append(i,n,l,a,v);return}const p=sessionStorage.getItem("esst_auth_notice");p==="expired"&&c(e("auth.sessionExpired"),"info"),p==="denied"&&c(e("auth.permissionDenied"),"error"),sessionStorage.removeItem("esst_auth_notice");const t=r("form",{class:"auth-form",novalidate:!0});t.innerHTML=`
      <div class="field">
        <label for="login-email">${e("auth.email")}</label>
        <input id="login-email" name="email" type="email" autocomplete="username" required />
      </div>
      <div class="field">
        <label for="login-password">${e("auth.password")}</label>
        <input id="login-password" name="password" type="password" autocomplete="current-password" required />
      </div>
      <button class="btn btn-primary btn-block" type="submit">${e("auth.signIn")}</button>`;const o=t.querySelector("button[type=submit]");t.addEventListener("submit",async i=>{i.preventDefault();const n=t.querySelector("#login-email").value,l=t.querySelector("#login-password").value;o.disabled=!0,o.textContent=e("auth.signingIn"),b.innerHTML="";try{const{profile:a}=await w(n,l);a?.role,u("/admin",{replace:!0})}catch(a){c(e(a?.key??"auth.error")),o.disabled=!1,o.textContent=e("auth.signIn")}}),m.append(t)},destroy(){}};async function d(s){try{L.loginDemo(s),u("/admin",{replace:!0})}catch{k(e("errors.generic"),"error")}}export{M as default};
