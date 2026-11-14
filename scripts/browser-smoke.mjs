/* Optional local browser smoke check. Uses installed Chrome/Edge, no downloaded packages.
 * Run a production server on 127.0.0.1:3100 before running this script.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
const origin = "http://127.0.0.1:3100";
const artifactRoot = path.resolve(".browser-test");
const browserPath = process.env.BROWSER_PATH || [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/snap/bin/chromium",
].find(candidate => fs.existsSync(candidate));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  if (!browserPath) throw new Error("Install Chrome or Edge to run this optional browser check.");
  assert.equal((await fetch(origin)).status, 200, "Local production server must be running on port 3100.");
  fs.mkdirSync(artifactRoot, { recursive: true });
  const profile = fs.mkdtempSync(path.join(artifactRoot, "profile-"));
  const browser = spawn(browserPath, [
    "--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu",
    "--no-first-run", "--no-default-browser-check",
    "--disable-background-networking", "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=0", "--user-data-dir=" + profile, "about:blank",
  ], { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });

  const browserStderr = [];
  browser.stderr?.on("data", chunk => browserStderr.push(chunk.toString()));

  // If Chromium exits before writing DevToolsActivePort, surface its stderr.
  browser.on("exit", code => {
    if (code !== 0 && browserStderr.length) {
      console.error("Chromium exited with code " + code + ". stderr:\n" + browserStderr.join(""));
    }
  });
  let socket;
  try {
    const activePort = path.join(profile, "DevToolsActivePort");
    for (let attempt = 0; attempt < 100 && !fs.existsSync(activePort); attempt++) await pause(100);
    assert.ok(fs.existsSync(activePort), "Headless browser did not expose its local debugging port.");
    const port = fs.readFileSync(activePort, "utf8").split("\n")[0].trim();
    const target = await (await fetch("http://127.0.0.1:" + port + "/json/new?about:blank", { method: "PUT" })).json();
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
    let id = 0;
    const pending = new Map();
    const errors = [];
    socket.addEventListener("message", event => {
      const message = JSON.parse(event.data);
      if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.text);
      if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
        errors.push(message.params.args.map(argument => argument.value || argument.description || "").join(" "));
      }
      if (message.id && pending.has(message.id)) {
        const { resolve, reject, timeout } = pending.get(message.id);
        clearTimeout(timeout);
        pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message)); else resolve(message.result);
      }
    });
    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const requestId = ++id;
        const timeout = setTimeout(() => { pending.delete(requestId); reject(new Error("Timed out: " + method)); }, 15000);
        pending.set(requestId, { resolve, reject, timeout });
        socket.send(JSON.stringify({ id: requestId, method, params }));
      });
    }
    async function evaluate(expression) {
      const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      return result.result.value;
    }
    async function wait(expression, label) {
      for (let attempt = 0; attempt < 100; attempt++) {
        if (await evaluate(expression)) return;
        await pause(100);
      }
      throw new Error("Timed out waiting for " + label);
    }
    async function clickText(text) {
      await evaluate("(() => { const element = [...document.querySelectorAll('button')].find(item => item.textContent.trim() === " + JSON.stringify(text) + " && !item.disabled); if (!element) throw new Error('Button unavailable: ' + " + JSON.stringify(text) + "); element.click(); })()");
    }
    async function fill(selector, value) {
      await evaluate("(() => { const element = document.querySelector(" + JSON.stringify(selector) + "); if (!element) throw new Error('Missing field'); const prototype = element.tagName === 'SELECT' ? HTMLSelectElement.prototype : element.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, " + JSON.stringify(value) + "); element.dispatchEvent(new Event('input', { bubbles: true })); element.dispatchEvent(new Event('change', { bubbles: true })); })()");
    }
    async function goto(route) {
      await send("Page.navigate", { url: origin + route });
      await wait("document.readyState === 'complete' && !!document.querySelector('#main-content')", route);
      await pause(250);
    }
    async function viewport(width) {
      await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 1024 });
    }
    async function noOverflow(label) {
      const dimensions = await evaluate("({ page: document.documentElement.scrollWidth, viewport: window.innerWidth })");
      assert.ok(dimensions.page <= dimensions.viewport + 1, label + " horizontal overflow: " + JSON.stringify(dimensions));
    }
    await send("Page.enable");
    await send("Runtime.enable");
    await viewport(1280);
    await goto("/");
    await clickText("Start guided demo");
    await wait("!![...document.querySelectorAll('button')].find(item => item.textContent.includes('Continue to next step') && !item.disabled)", "dashboard guide");
    await clickText("Continue to next step");
    await wait("location.pathname === '/groups' && !!document.querySelector('[aria-label=\"Open Little Waves\"]')", "groups");
    await evaluate("document.querySelector('[aria-label=\"Open Little Waves\"]').click()");
    await wait("!!document.querySelector('#group-editor')", "group editor");
    assert.equal(await evaluate("document.querySelector('input[name=capacity]').value"), "8");
    await clickText("Cancel");
    await clickText("Continue to next step");
    await wait("location.pathname === '/attendance' && !!document.querySelector('[aria-label=\"Attendance for Demo Swimmer 02\"]')", "attendance");
    await fill('[aria-label="Attendance for Demo Swimmer 02"]', "Present");
    await wait("!![...document.querySelectorAll('button')].find(item => item.textContent.includes('Continue to next step') && !item.disabled)", "saved attendance");
    await clickText("Continue to next step");
    await wait("location.pathname === '/registrations' && !!document.querySelector('[name=demoNumber]')", "registration");
    await fill('[name="demoNumber"]', "3");
    await fill('[name="level"]', "Beginner");
    await evaluate("document.querySelector('[name=fictionalOnly]').click()");
    await clickText("Submit demo enquiry");
    await wait("document.querySelector('tbody')?.textContent.includes('Demo Applicant 03')", "enquiry saved");
    await clickText("Continue to next step");
    await wait("location.pathname === '/shark-ai' && !!document.querySelector('#generator')", "Content Studio");
    await clickText("Use fictional example");
    await clickText("Generate 3 examples");
    await wait("[...document.querySelectorAll('button')].filter(item => item.textContent.trim() === 'Save as draft').length === 3", "three examples");
    await clickText("Save as draft");
    await wait("!!document.querySelector('#drafts textarea')", "saved draft");
    await clickText("Continue to next step");
    await clickText("Approve draft");
    await wait("!!document.querySelector('#drafts input[type=date]') && !document.querySelector('#drafts input[type=date]').matches(':disabled')", "approved draft");
    await fill("#drafts input[type=date]", "2026-10-14");
    await clickText("Add to calendar");
    await wait("document.querySelector('#calendar').textContent.includes('1 planned this week')", "calendar plan");
    await clickText("Finish walkthrough");
    await wait("document.body.textContent.includes('All six demonstration steps completed')", "finished walkthrough");
    console.log("PASS six-step browser walkthrough, draft approval and calendar");
    await noOverflow("desktop");
    await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }).then(result => fs.writeFileSync(path.join(artifactRoot, "desktop.png"), Buffer.from(result.data, "base64")));

    for (const width of [390, 320]) {
      await viewport(width);
      for (const route of ["/", "/swimmers", "/groups", "/attendance", "/registrations", "/shark-ai", "/settings"]) {
        await goto(route);
        await noOverflow(width + "px " + route);
      }
      await goto("/groups");
      await evaluate("document.querySelector('[aria-label=\"Open Little Waves\"]').click()");
      await wait("!!document.querySelector('#group-editor')", "mobile group editor");
      await noOverflow(width + "px group editor");
      await evaluate("document.querySelector('[aria-label=\"Open navigation\"]').click()");
      assert.equal(await evaluate("document.querySelector('#mobile-navigation').hidden"), false);
      await evaluate("document.querySelector('#mobile-navigation a').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))");
      assert.equal(await evaluate("document.querySelector('#mobile-navigation').hidden"), true);
      console.log("PASS " + width + "px all routes, editor sizing and Escape navigation");
    }
    await goto("/shark-ai");
    await fill('select[name="language"]', "aeb");
    await clickText("Use fictional example");
    await clickText("Generate 3 examples");
    await wait("[...document.querySelectorAll('[dir=rtl]')].length >= 3", "Tunisian Arabic output");
    await clickText("Save as draft");
    await noOverflow("320px generated Arabic and draft editors");
    await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }).then(result => fs.writeFileSync(path.join(artifactRoot, "mobile.png"), Buffer.from(result.data, "base64")));
    await evaluate("document.querySelector('#drafts').scrollIntoView()");
    await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }).then(result => fs.writeFileSync(path.join(artifactRoot, "mobile-editor.png"), Buffer.from(result.data, "base64")));
    await clickText("Reset demo data");
    await wait("!document.querySelector('#reset-confirmation').hidden", "reset confirmation");
    await clickText("Keep my changes");
    assert.ok(await evaluate("!!document.querySelector('#drafts textarea')"));
    await clickText("Reset demo data");
    await clickText("Reset everything");
    await wait("!document.querySelector('#drafts textarea') && document.body.textContent.includes('Start guided demo')", "full reset");
    console.log("PASS cancel reset preserves data; full reset clears drafts and walkthrough");
    await goto("/does-not-exist");
    await wait("document.body.textContent.includes('This page is outside the demo')", "custom 404");
    assert.deepEqual(errors, [], "Unexpected browser errors");
    console.log("PASS custom 404 and no browser runtime errors");
    await send("Browser.close").catch(() => {});
  } finally {
    if (socket) socket.close();
    browser.kill();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
