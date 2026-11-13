import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const origin=process.env.SHARK_SMOKE_ORIGIN??"http://127.0.0.1:3193";
assert.match(origin,/^http:\/\/127\.0\.0\.1:\d+$/);
const browserPath=["C:/Program Files/Google/Chrome/Application/chrome.exe","C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(existsSync);
assert.ok(browserPath,"Chrome or Edge is required.");
const fixture=JSON.parse(process.env.SHARK_MANAGEMENT_FIXTURES??"{}");
assert.ok(fixture.admin?.email?.endsWith("@example.test")&&fixture.admin?.password&&fixture.parent?.email?.endsWith("@example.test"),"Synthetic local fixtures required");
const run=Date.now().toString(36);
const profile=mkdtempSync(join(tmpdir(),"shark-admin-smoke-"));
const chrome=spawn(browserPath,["--headless=new","--disable-gpu","--disable-background-networking","--no-first-run",
  "--remote-debugging-address=127.0.0.1","--remote-debugging-port=0","--user-data-dir="+profile,"about:blank"],{windowsHide:true,stdio:"ignore"});
const pause=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
let ws;
async function wait(check,message) {
  for(let i=0;i<300;i++){try{const value=await check();if(value)return value;}catch{} await pause(100);}
  throw new Error(message);
}
try {
  const port=await wait(()=>readFileSync(join(profile,"DevToolsActivePort"),"utf8").split("\n")[0],"Browser did not start.");
  const target=await (await fetch("http://127.0.0.1:"+port+"/json/new?about:blank",{method:"PUT"})).json();
  ws=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.addEventListener("open",resolve,{once:true});ws.addEventListener("error",reject,{once:true});});
  let nextId=0, posted=0;
  const posts=new Set();
  const pending=new Map();
  ws.addEventListener("message",event=>{
    const response=JSON.parse(event.data);
    pending.get(response.id)?.(response);
    const packet=response.params;
    if(response.method==="Network.requestWillBeSent" && packet.request.method==="POST" && packet.request.url.startsWith(origin+"/admin")) posts.add(packet.requestId);
    if(response.method==="Network.loadingFinished" && posts.delete(packet.requestId)) posted++;
  });
  function cdp(method,params={}) {
    return new Promise((resolve,reject)=>{
      const id=++nextId;
      const timeout=setTimeout(()=>{pending.delete(id);reject(new Error("Browser command timed out: "+method));},25000);
      pending.set(id,response=>{
        clearTimeout(timeout);pending.delete(id);
        if(response.error) reject(new Error("Browser command failed: "+method)); else resolve(response.result);
      });
      ws.send(JSON.stringify({id,method,params}));
    });
  }
  async function evaluate(expression) {
    const result=await cdp("Runtime.evaluate",{expression,returnByValue:true});
    if(result.exceptionDetails) throw new Error("Browser evaluation failed.");
    return result.result.value;
  }
  const string=JSON.stringify;
  const content=(value)=>wait(()=>evaluate("document.body?.innerText.includes("+string(value)+")"),"Missing UI text: "+value);
  async function go(route,expected){
    await evaluate("window.__sharkOldDocument=true");
    await cdp("Page.navigate",{url:origin+route});
    await wait(()=>evaluate("!window.__sharkOldDocument && document.readyState!=='loading'"),"Navigation did not finish.");
    await content(expected);
  }
  async function form(button,values) {
    const marker="submit "+button;
    const previous=posted;
    await wait(()=>evaluate("Array.from(document.querySelectorAll('form button')).some(b=>b.textContent.trim()==="+string(button)+")"),marker);
    assert.equal(await evaluate(`(() => {
      const b=[...document.querySelectorAll('form button')].find(e=>e.textContent.trim()===${string(button)});
      if(!b)return false;
      for(const [name,value] of Object.entries(${string(values)})){
        const e=b.form.elements.namedItem(name);if(!e)return false;
        if(e.type==="checkbox")e.checked=value;else e.value=value;
        e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));
      }
      if(!b.form.checkValidity())return false;
      b.click();return true;
    })()`),true,marker);
    await wait(()=>posted>previous,"No completed POST for "+button);
    await pause(300);
  }
  const save=()=>content("Changes saved.");
  await cdp("Network.enable");
  await go("/admin/coaches","Admin sign-in");
  await form("Sign in",{email:fixture.parent.email,password:fixture.parent.password});
  await content("no Admin access");
  await go("/admin/login","Your account");
  await form("Sign in",fixture.admin);await content("Academy overview");
  await go("/admin/swimmers","Register swimmer");
  await form("Create swimmer",{name:"Synthetic Management "+run,level:"beginner",status:"active"});await save();
  const swimmer=await evaluate("new URLSearchParams(location.search).get('swimmer')");assert.match(swimmer,/^[0-9a-f-]{36}$/);
  await form("Save swimmer",{name:"Synthetic Edited "+run});await content("Synthetic Edited "+run);
  await form("Add internal note",{body:"Synthetic private note "+run});await save();
  await form("Publish note to Parents",{});await content("Published to verified Parents");
  await form("Withdraw note",{});await save();
  await form("Save Certificat",{status:"received"});await save();
  await form("Publish to Parents",{});await content("Published to verified Parents");
  await form("Hide from Parents",{});await save();
  console.log("PASS swimmer create/edit, internal note publication/withdrawal, document publication and Parent role denial");
  await go("/admin/coaches","Add coach");
  await form("Create coach",{name:"Synthetic Coach "+run});await content("Edit coach");await save();
  const coach=await evaluate("new URLSearchParams(location.search).get('coach')");
  await form("Save coach",{name:"Synthetic Coach Updated "+run});await content("Synthetic Coach Updated "+run);
  await go("/admin/groups?swimmer="+swimmer,"Create training group");
  await form("Create group",{name:"Synthetic Group "+run,level:"beginner",capacity:"1",schedule:"Variable training"});await save();
  const group=await evaluate("new URLSearchParams(location.search).get('group')");assert.match(group,/^[0-9a-f-]{36}$/);
  const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Tunis",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const tomorrow=new Date(Date.parse(today+"T00:00:00Z")+86400000).toISOString().slice(0,10);
  await form("Assign swimmer",{swimmer,group,from:today});await save();
  await form("Assign coach",{coach,group,from:today,primary:true});await save();await content("1 / 1 places occupied today");
  await go("/admin/coaches?coach="+coach,"Coach swimmer roster");await content("Synthetic Edited "+run);await content("Synthetic Group "+run);
  await form("End assignment",{until:tomorrow});await save();await content(tomorrow);
  await go("/admin/attendance?group="+group,"Schedule a session");
  await form("Create session",{day:today});await content("Session roster");
  await form("Update session",{status:"open"});await content("Session status: open");
  for(const status of ["present","absent","excused"]){await form("Save attendance",{status,reason:"Synthetic correction"});await save();}
  await content("present → absent");await content("absent → excused");
  await go("/admin/swimmers?swimmer="+swimmer,"Attendance history");await content("absent → excused");await content("Synthetic Group "+run);
  console.log("PASS coach create/edit, dated primary assignment, assignment ending, group roster, session and all attendance statuses/history");
  await go("/admin/subscriptions?swimmer="+swimmer,"Create a plan");
  await form("Create plan",{code:"TEST_"+run.toUpperCase(),label:"Synthetic Plan "+run,price:"75",active:true});await save();
  const plan=await evaluate("[...document.querySelectorAll('select[name=plan] option')].find(o=>o.textContent.includes("+string("Synthetic Plan "+run)+"))?.value");
  await form("Assign subscription",{plan,start:"2026-01-01"});await save();await content("Missing observation");
  for(const status of ["paid","pending","unpaid","unknown","blank"]){await form("Save monthly status",{status});await save();assert.equal(await evaluate("[...document.querySelectorAll('form')].find(f=>f.querySelector('button')?.textContent==='Save monthly status').elements.namedItem('status').value"),status);}
  await form("Save subscription term",{start:"2026-01-01",end:"2027-01-01",lifecycle:"confirmed"});await save();
  await go("/admin/groups?group="+group,"Group roster");
  await cdp("Emulation.setDeviceMetricsOverride",{width:390,height:844,deviceScaleFactor:1,mobile:true});
  assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth+1"),true);
  await form("Sign out",{});await content("Admin sign-in");
  console.log("PASS subscription price snapshot, five recorded status semantics, missing observation, term edit, mobile roster and logout");
} finally {
 ws?.close();chrome.kill();await pause(500);try{rmSync(profile,{recursive:true,force:true});}catch{}
}
process.exit(0);
