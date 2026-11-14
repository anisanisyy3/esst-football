import{e as h,t as a,b as y,c as u}from"./index-Bzu0St5_.js";import{s as f,d as o}from"./dataService-D6aeBORS.js";import{l as w,g as c}from"./settingsCache-Cu85K49s.js";import{c as b}from"./standings-L4P47zG5.js";import{s as _}from"./standingsTable-DLmXX4jw.js";const v={title:"page.standings",async render(s){await w();let t;try{t=await d()}catch(e){s.innerHTML="",s.append(h({message:a(e?.key??"errors.dbConnection"),retryLabel:a("common.retry"),onRetry:()=>this.render(s)}));return}const r=({teams:e,matches:l})=>{const i=b(e,l,c()),p=i.some(g=>g.played>0),n=c(),m=a("standings.rules",{win:n.points_for_win,draw:n.points_for_draw,loss:n.points_for_loss});s.innerHTML=`
      <header class="page-header">
        <h1>${a("page.standings")}</h1>
        <p class="page-subtitle">${y(a("standings.note"))}</p>
      </header>
      ${p?`
          <div class="standings-wrap">${_(i)}</div>
          <p class="standings-rules">${m}</p>`:u({icon:"🏆",message:a("standings.empty")})}`};r(t),this._unsub=f(async()=>{try{r(await d())}catch{}})},destroy(){this._unsub?.()}};async function d(){const[s,t]=await Promise.all([o.listTeams(),o.listMatches()]);return{teams:s,matches:t}}export{v as default};
