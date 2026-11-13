/* Optional local browser smoke check. Uses installed Chrome/Edge, no downloaded packages.
 * Run a production server on 127.0.0.1:3100 before running this script.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
const mediaLibrary = JSON.parse(fs.readFileSync(new URL("../src/config/public-media-manifest.json", import.meta.url), "utf8"));
const origin = process.env.SMOKE_ORIGIN || "http://127.0.0.1:3100";
const artifactRoot = path.resolve(".browser-test");
const browserPath = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find(candidate => fs.existsSync(candidate));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  if (!browserPath) throw new Error("Install Chrome or Edge to run this optional browser check.");
  assert.equal((await fetch(origin)).status, 200, "Local production server must be running on port 3100.");
  const registrationResponse = await fetch(origin + "/inscription");
  assert.equal(registrationResponse.status, 200);
  const registrationHtml = await registrationResponse.text();
  assert.match(registrationHtml, /name="robots" content="noindex, follow"/);
  assert.match(registrationHtml, /Le règlement se fait en personne avant le début des séances/);
  assert.doesNotMatch(registrationHtml, /90\s*DT|suspension temporaire|assurance de base|remboursement|premiers soins|décline toute responsabilité/i);
  for (const route of ["/dashboard", "/swimmers", "/groups", "/attendance", "/registrations", "/shark-ai", "/settings"]) {
    const response = await fetch(origin + route);
    assert.equal(response.status, 200, route);
    assert.match(await response.text(), /name="robots" content="noindex, nofollow"/, route + " demo metadata");
  }
  for (const photo of Object.values(mediaLibrary.photos)) {
    for (const variant of photo.variants) assert.equal((await fetch(origin + variant.url)).status, 200, variant.url);
  }
  for (const video of Object.values(mediaLibrary.videos).filter(asset => asset.available !== false)) {
    assert.equal((await fetch(origin + video.url)).status, 200, video.url);
    assert.equal((await fetch(origin + video.poster)).status, 200, video.poster);
  }
  for (const privatePath of ['/docs/media-audit/media-manifest.json', '/.local-dev/media-audit/media-manifest.json', '/docs/V0.5-REGISTRATION-DOCUMENT-REVIEW.md', '/docs/V0.5.1-PROMOTIONAL-IMAGE-CONSENT-DRAFT.md']) assert.equal((await fetch(origin + privatePath)).status, 404);
  fs.mkdirSync(artifactRoot, { recursive: true });
  const profile = fs.mkdtempSync(path.join(artifactRoot, "profile-"));
  const browser = spawn(browserPath, [
    "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    "--disable-background-networking", "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=0", "--user-data-dir=" + profile, "about:blank",
  ], { windowsHide: true, stdio: "ignore" });
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
      await wait("document.readyState === 'complete' && !!document.querySelector('#main-content, #public-content')", route);
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
    await send("Page.addScriptToEvaluateOnNewDocument", { source: `
      window.revealStarts = { shark: 0, story: 0 };
      document.addEventListener('animationstart', ({ target, animationName }) => {
        if (target.matches('[data-hero-shark]') && animationName === getComputedStyle(target).animationName.split(',')[0].trim()) window.revealStarts.shark++;
        if (target.matches('#story li:first-child')) window.revealStarts.story++;
      });
    ` });
    await viewport(1280);
    await goto("/");
    assert.match(await evaluate("document.title"), /Shark Aquatics/);
    await wait("document.querySelector('[data-media-photo=hero-swimming-lesson]')?.textContent.includes('Visuel de démonstration')", "labeled hero placeholder");
    assert.equal(await evaluate("document.querySelectorAll('[data-hero-shark] img').length"), 0, "No uncleared shark artwork");
    assert.equal(await evaluate("document.querySelector('[data-hero-shark]').getAttribute('aria-hidden')"), 'true');
    assert.equal(await evaluate("getComputedStyle(document.querySelector('[data-hero-shark]')).pointerEvents"), 'none');
    await wait("window.revealStarts.shark === 1", "one-time hero badge entrance");
    await evaluate("document.querySelector('#story li').scrollIntoView({ block: 'center', behavior: 'instant' })");
    await wait("window.revealStarts.story === 1", "story reveal");
    await wait("getComputedStyle(document.querySelector('[data-hero-shark]')).animationPlayState.endsWith('paused')", "offscreen shark pauses");
    await evaluate("window.scrollTo({ top: 0, behavior: 'instant' })");
    await pause(250);
    await evaluate("document.querySelector('#story li').scrollIntoView({ block: 'center', behavior: 'instant' })");
    await pause(250);
    await evaluate("window.scrollTo({ top: 0, behavior: 'instant' })");
    await pause(850);
    assert.deepEqual(await evaluate("window.revealStarts"), { shark: 1, story: 1 });
    await wait("getComputedStyle(document.querySelector('[data-hero-shark]')).animationPlayState === 'running, running'", "onscreen shark resumes");
    console.log("PASS hero and story entrances run once per mount");
    assert.ok(await evaluate("!!document.querySelector('#public-navigation a[href=\"/inscription\"]') && !!document.querySelector('footer a[href=\"/inscription\"]')"));
    assert.equal(await evaluate("document.querySelector('#trial a[href=\"/inscription\"]').textContent.trim()"), "Comment s'inscrire ?");
    await evaluate("document.querySelector('#public-navigation a[href=\"/inscription\"]').click()");
    await wait("location.pathname === '/inscription' && !!document.querySelector('[data-public-registration]')", "registration navigation");
    for (const width of [1440, 1024, 768, 390, 320]) {
      await viewport(width);
      await noOverflow("registration at " + width);
      if (width === 1440 || width === 390) {
        const metrics = await send("Page.getLayoutMetrics");
        const clip = { x: 0, y: 0, width, height: metrics.cssContentSize.height, scale: 1 };
        const screenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip });
        fs.writeFileSync(path.join(artifactRoot, "registration-" + width + ".png"), Buffer.from(screenshot.data, "base64"));
      }
    }
    assert.equal(await evaluate("document.querySelectorAll('[data-public-registration] input:not([type=checkbox]), [data-public-registration] form').length"), 0);
    assert.equal(await evaluate("document.querySelectorAll('[data-public-registration] input[type=checkbox]').length"), 4);
    const registrationStorageBefore = await evaluate("JSON.stringify([localStorage, sessionStorage])");
    await evaluate("document.querySelector('[data-public-registration] label').click()");
    assert.equal(await evaluate("document.querySelector('[data-public-registration] input').checked"), true);
    assert.equal(await evaluate("JSON.stringify([localStorage, sessionStorage])"), registrationStorageBefore);
    for (const section of ['registration-rules', 'registration-faq']) {
      const selector = "section[aria-labelledby=" + section + "] summary";
      await evaluate("document.querySelector(" + JSON.stringify(selector) + ").focus()");
      assert.equal(await evaluate("document.activeElement.matches(" + JSON.stringify(selector) + ")"), true);
      await send("Input.dispatchKeyEvent", { type: "keyDown", key: " ", code: "Space", windowsVirtualKeyCode: 32, text: " " });
      await send("Input.dispatchKeyEvent", { type: "keyUp", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
      await wait("document.querySelector(" + JSON.stringify(selector) + ").parentElement.open", section + " opens from the keyboard");
    }
    const enrolmentLink = new URL(await evaluate("document.querySelector('[data-registration-whatsapp]').href"));
    assert.equal(enrolmentLink.origin + enrolmentLink.pathname, "https://wa.me/21650765765");
    assert.equal(enrolmentLink.searchParams.get("text"), "Bonjour Shark Aquatics, je souhaite obtenir des informations sur les inscriptions, les places disponibles et les documents nécessaires.");
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    await goto("/inscription");
    assert.equal(await evaluate("document.querySelectorAll('[data-public-registration] [data-revealed]').length"), 0);
    assert.equal(await evaluate("getComputedStyle(document.querySelector('[data-public-registration] h1')).opacity"), "1");
    await send("Emulation.setEmulatedMedia", { features: [] });
    console.log("PASS registration navigation, checklist, keyboard accordions, WhatsApp and reduced motion");
    await viewport(1280);
    await goto("/");
    assert.equal(await evaluate("document.querySelectorAll('video[src]').length"), 0, 'Videos must have no source before explicit activation');
    assert.equal(await evaluate("performance.getEntriesByType('resource').filter(item => item.name.includes('.mp4')).length"), 0, 'No initial MP4 download');
    assert.equal(await evaluate("document.querySelectorAll('[data-media-photo]').length"), 4);
    assert.equal(await evaluate("document.querySelectorAll('[data-location-map] iframe').length"), 0, 'No third-party map during initial hero rendering');
    assert.equal(await evaluate("document.querySelectorAll('#team img').length"), 0, 'Uncleared portraits omitted');
    fs.writeFileSync(path.join(artifactRoot, 'media-initial-load.json'), JSON.stringify(await evaluate("performance.getEntriesByType('resource').filter(item => item.name.includes('/_next/image') || item.name.includes('/media/')).map(item => ({ name: item.name, transferSize: item.transferSize, encodedBodySize: item.encodedBodySize }))"), null, 2));
    assert.equal(await evaluate("document.querySelector('#public-top').lang"), "fr");
    assert.equal(await evaluate("document.querySelectorAll('#public-top header img').length"), 0, 'Official logo withheld from publication');

    assert.ok(await evaluate("getComputedStyle(document.querySelector('section[aria-labelledby=hero-title]')).backgroundImage.includes('gradient')"), "Public hero CSS must load");
    assert.equal(await evaluate("document.querySelector('meta[name=robots]').content"), "noindex, follow");
    await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }).then(result => fs.writeFileSync(path.join(artifactRoot, "public-home.png"), Buffer.from(result.data, "base64")));
    assert.equal(await evaluate("!!document.querySelector('[aria-label=\"Navigation publique\"]')"), true);
    assert.equal(await evaluate("!!document.querySelector('#reset-demo-data')"), false);
    assert.equal(await evaluate("!!document.querySelector('form')"), false);
    assert.ok(await evaluate("document.querySelector('#programs').textContent.includes('Enfants dès 3 ans')"));
    assert.ok(await evaluate("document.querySelector('#programs').textContent.includes('Adultes')"));
    assert.ok(await evaluate("document.querySelector('#programs').textContent.includes('niveau')"));
    assert.equal(await evaluate("document.querySelectorAll('#public-content h1').length"), 1);
    for (const section of ['programs', 'team', 'contact']) {
      assert.ok(await evaluate("!!document.querySelector('#" + section + "[aria-labelledby]')"));
      await evaluate("document.querySelector('nav a[href=\"/#" + section + "\"]').click()");
      await wait("location.hash === '#" + section + "'", section + " navigation anchor");
    }
    assert.equal(await evaluate("!!document.querySelector('a[href*=\"instagram.com\"]')"), false);
    assert.equal(await evaluate("document.querySelectorAll('#public-content input, #public-content textarea, #public-content [contenteditable]').length"), 0, "No personal-data inputs");
    assert.equal(await evaluate("document.querySelectorAll('#public-content select').length"), 3);
    assert.equal(await evaluate("!!document.querySelector('[data-trial-whatsapp]')"), false, "Choose an audience before continuing");
    const storageBefore = await evaluate("JSON.stringify({ local: {...localStorage}, session: {...sessionStorage}, cookie: document.cookie })");
    await evaluate("document.querySelector('section[aria-labelledby=hero-title] a[href=\"#trial\"]').click()");
    await wait("location.hash === '#trial'", "trial CTA anchor");
    assert.ok(await evaluate("document.querySelector('#trial').textContent.includes(\"Séance d'essai gratuite\") && document.querySelector('#trial').textContent.includes('Horaires selon les disponibilités')"));
    assert.deepEqual(await evaluate("[...document.querySelector('[data-trial-audience]').options].map(item => item.value)"), ['', 'child', 'adult']);
    assert.deepEqual(await evaluate("[...document.querySelector('[data-trial-level]').options].map(item => item.value)"), ['unknown', 'beginner', 'intermediate', 'advanced']);
    for (const [audience, audienceLabel] of [['child', 'Enfant (3 ans et plus)'], ['adult', 'Adulte']]) {
      await fill('[data-trial-audience]', audience);
      for (const [level, levelLabel] of [['unknown', 'Je ne sais pas'], ['beginner', 'Débutant'], ['intermediate', 'Intermédiaire'], ['advanced', 'Avancé']]) {
        await fill('[data-trial-level]', level);
        await wait("!!document.querySelector('[data-trial-whatsapp]')", "trial request link");
        const link = await evaluate("(() => { const a = document.querySelector('[data-trial-whatsapp]'); return { href: a.href, target: a.target, rel: a.rel }; })()");
        const url = new URL(link.href);
        assert.equal(url.origin, 'https://wa.me');
        assert.equal(url.pathname, '/21650765765');
        const message = url.searchParams.get('text');
        assert.ok(message.includes('Public : ' + audienceLabel));
        assert.ok(message.includes('Niveau estimé : ' + levelLabel));
        assert.ok(message.includes("séance d'essai gratuite"));
        assert.ok(message.includes('Quels horaires') && message.includes('selon les disponibilités'));
        assert.equal(await evaluate("!!document.querySelector('[data-trial-message]')"), false);
        assert.equal(link.target, '_blank');
        assert.ok(link.rel.includes('noopener'));
        assert.equal(await evaluate("location.pathname"), '/');
      }
    }
    assert.equal(await evaluate("JSON.stringify({ local: {...localStorage}, session: {...sessionStorage}, cookie: document.cookie })"), storageBefore, "Selections must not persist");
    await fill('[data-trial-audience]', '');
    assert.equal(await evaluate("!!document.querySelector('[data-trial-whatsapp]')"), false);
    console.log("PASS all eight free-trial requests, direct encoded message and no personal-data fields/storage");
    const directions = new URL(await evaluate("document.querySelector('[data-directions]').href"));
    assert.equal(directions.pathname, '/maps/dir/');
    assert.equal(directions.searchParams.get('api'), '1');
    assert.equal(directions.searchParams.get('destination'), 'Hotel Liberty Resort, BP 122 Skanes, 5000, Monastir, Tunisia');
    assert.deepEqual(await evaluate("[...document.querySelectorAll('#team article h3')].map(item => item.textContent)"), ['Coach Mehdi', 'Coach Hatem', 'Coach Taher', 'Coach Mehdi B']);
    assert.equal(await evaluate("!!document.querySelector('#public-content form')"), false);
    assert.equal(await evaluate("document.querySelector('#hero-title').textContent"), 'Apprenez. Progressez. Nagez.');
    for (const audience of ['child', 'adult']) {
      await evaluate("[...document.querySelectorAll('[data-program-explorer] button')][" + (audience === 'child' ? 0 : 1) + "].click()");
      for (const level of ['unknown', 'beginner', 'intermediate', 'advanced']) {
        await fill('[data-program-level]', level);
        const url = new URL(await evaluate("document.querySelector('[data-program-whatsapp]').href"));
        assert.equal(url.pathname, '/21650765765');
        assert.ok(url.searchParams.get('text').includes('programmes de natation'));
        assert.ok(!url.searchParams.get('text').includes("séance d'essai"));
      }
    }
    await evaluate("document.querySelector('[aria-label=\"Coach suivant\"]').click()");
    await wait("document.querySelector('[aria-label=\"Coach précédent\"]').disabled === false", "carousel next");
    await evaluate("document.querySelector('[aria-label=\"Coach précédent\"]').click()");
    await evaluate("document.querySelector('[aria-label=\"Les coachs Shark Aquatics\"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))");
    await wait("document.querySelector('[aria-label=\"Coach suivant\"]').disabled", "carousel End key");
    await wait("[...document.querySelectorAll('#team img')].every(image => image.naturalWidth > 0)", "mapped coach portraits load");
    await evaluate("document.querySelector('[aria-label=\"Les coachs Shark Aquatics\"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))");
    await wait("document.querySelector('[aria-label=\"Coach précédent\"]').disabled", "carousel Home key");
    console.log('PASS program enquiries and coach carousel buttons/keyboard');
    await evaluate("document.querySelector('.skip-link').focus()");
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
    await wait("document.activeElement.id === 'public-content'", "keyboard skip link");
    console.log("PASS approved academy content, WhatsApp/directions links, anchors and keyboard skip link");
    await evaluate("document.querySelector('a[href=\"/dashboard\"]').click()");
    await wait("location.pathname === '/dashboard' && !!document.querySelector('#reset-demo-data')", "workspace entry");
    assert.equal(await evaluate("document.querySelector('[aria-label=\"Navigation publique\"]')?.checkVisibility() ?? false"), false);
    console.log("PASS public homepage isolated from demo workspace");
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
    await evaluate("document.querySelector('aside a[href=\"/dashboard\"]').click()");
    await wait("location.pathname === '/dashboard' && [...document.querySelectorAll('main a[href=\"/attendance\"]')].some(item => item.checkVisibility() && item.textContent.includes('100%'))", "attendance retained on dashboard return");
    assert.ok(await evaluate("document.body.textContent.includes('All six demonstration steps completed')"));
    console.log("PASS six-step browser walkthrough, draft approval, calendar and shared workspace state");
    await noOverflow("desktop");
    await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }).then(result => fs.writeFileSync(path.join(artifactRoot, "desktop.png"), Buffer.from(result.data, "base64")));

    for (const width of [1440, 1280, 1024, 768, 430, 390, 360, 320]) {
      await viewport(width);
      for (const route of ["/", "/dashboard", "/swimmers", "/groups", "/attendance", "/registrations", "/shark-ai", "/settings"]) {
        await goto(route);
        await noOverflow(width + "px " + route);
        if (route === "/") {
          const revealDuration = await evaluate("getComputedStyle(document.querySelector('#public-top')).getPropertyValue('--reveal-duration').trim()");
          const revealMs = parseFloat(revealDuration) * (revealDuration.endsWith('ms') ? 1 : 1000);
          assert.equal(Math.round(revealMs), width < 768 ? 380 : 540);
          assert.ok(await evaluate("document.querySelector('#public-top header').getBoundingClientRect().height < 110"), 'Header must remain compact');
          await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }).then(result => fs.writeFileSync(path.join(artifactRoot, "public-hero-" + width + ".png"), Buffer.from(result.data, "base64")));
          const order = await evaluate("({ image: document.querySelector('#public-content figure').getBoundingClientRect().top, title: document.querySelector('#hero-title').getBoundingClientRect().top })");
          if (width < 1024) assert.ok(order.title < order.image, 'Stacked hero must be text first');
          if (width < 768) {
            const cta = await evaluate("(() => { const r = document.querySelector('section[aria-labelledby=hero-title] a[href=\"#trial\"]').getBoundingClientRect(); return { bottom: r.bottom, height: r.height, viewport: innerHeight }; })()");
            assert.ok(cta.height >= 48 && cta.bottom <= cta.viewport, 'Trial CTA must be touch accessible on the first screen');
          }
          if (width <= 1050) {
          await evaluate("document.querySelector('[aria-controls=public-navigation]').click()");
          assert.equal(await evaluate("document.querySelector('[aria-controls=public-navigation]').getAttribute('aria-expanded')"), 'true');
          await evaluate("document.querySelector('#public-navigation a').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))");
          assert.equal(await evaluate("document.querySelector('[aria-controls=public-navigation]').getAttribute('aria-expanded')"), 'false');
          }
          await fill('[data-trial-audience]', 'child');
          await fill('[data-trial-level]', 'intermediate');
          await wait("!!document.querySelector('[data-trial-whatsapp]')", "mobile direct trial action");
          await noOverflow(width + "px trial message and controls");
          await evaluate("document.querySelector('#trial').scrollIntoView()");
          await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }).then(result => fs.writeFileSync(path.join(artifactRoot, "trial-" + width + ".png"), Buffer.from(result.data, "base64")));
          await evaluate('window.scrollTo(0, 0)');
          await pause(200);
          const metrics = await send("Page.getLayoutMetrics");
          await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: metrics.cssContentSize.height, scale: 1 } }).then(result => fs.writeFileSync(path.join(artifactRoot, "public-" + width + ".png"), Buffer.from(result.data, "base64")));
        }
      }
      await goto("/groups");
      await evaluate("document.querySelector('[aria-label=\"Open Little Waves\"]').click()");
      await wait("!!document.querySelector('#group-editor')", "mobile group editor");
      await noOverflow(width + "px group editor");
      if (width < 1024) {
      await evaluate("document.querySelector('[aria-label=\"Open navigation\"]').click()");
      assert.equal(await evaluate("document.querySelector('#mobile-navigation').hidden"), false);
      await evaluate("document.querySelector('#mobile-navigation a').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))");
      assert.equal(await evaluate("document.querySelector('#mobile-navigation').hidden"), true);
      }
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
    for (const width of [1280, 390]) {
      await viewport(width);
      await goto('/');
      await evaluate("document.querySelector('[data-location-map]').scrollIntoView({block:'center'})");
      assert.equal(await evaluate("document.querySelectorAll('[data-location-map] iframe').length"), 0);
      await evaluate("document.querySelector('[data-location-map] button').click()");
      await wait("document.querySelector('[data-location-map] iframe')?.getBoundingClientRect().height >= 338", 'map activated with reserved height');
      assert.equal(await evaluate("document.querySelector('[data-location-map] iframe').parentElement.getAnimations().length"), 0);
      const frame = await evaluate("(() => { const f=document.querySelector('[data-location-map] iframe'); return {src:f.src,title:f.title,loading:f.loading,height:f.getBoundingClientRect().height}; })()");
      assert.equal(new URL(frame.src).searchParams.get('q'), '35.7671468,10.7198879');
      assert.equal(frame.loading, 'lazy');
      assert.ok(frame.title.includes('Hotel Liberty Resort') && frame.height >= 338, JSON.stringify(frame));
      await pause(2500);
      await send('Page.captureScreenshot', {format:'png',captureBeyondViewport:false}).then(result => fs.writeFileSync(path.join(artifactRoot, 'location-map-'+width+'.png'), Buffer.from(result.data,'base64')));
      fs.writeFileSync(path.join(artifactRoot,'map-frames-'+width+'.json'), JSON.stringify(await send('Page.getFrameTree'),null,2));
      await evaluate("document.querySelector('[data-location-map] button').click()");
      assert.equal(await evaluate("document.querySelectorAll('[data-location-map] iframe').length"), 0, 'Map can be closed to restore scrolling');
    }
    console.log('PASS map opt-in, hotel destination, reserved frame, mobile close and external fallback');
    await send('Network.enable');
    await send('Network.setBlockedURLs', {urls:['*www.google.com/maps*']});
    await goto('/');
    await evaluate("document.querySelector('[data-location-map]').scrollIntoView({block:'center'}); document.querySelector('[data-location-map] button').click()");
    await pause(500);
    assert.ok(await evaluate("document.querySelector('[data-location-map] a').href.includes('ftid=')"), 'Blocked embed retains canonical destination fallback');
    await send('Network.setBlockedURLs', {urls:[]});
    await viewport(1280);
    await goto('/');
    assert.equal(await evaluate("document.querySelectorAll('video').length"), 0, 'No child videos in Preview');
    assert.equal(await evaluate("[...document.querySelectorAll('[data-featured-video]')].every(node => node.textContent.includes('Vidéo omise'))"), true);
    assert.equal(await evaluate("document.querySelectorAll('[data-media-photo] img').length"), 0, 'All photo slots use neutral placeholders');
    for (const path of ['/brand/shark-aquatics-logo.jpg','/media/photos/hero-swimming-lesson-960.webp','/media/videos/hero-motion-preview.mp4']) assert.equal((await fetch(origin+path)).status,404);
    console.log('PASS uncleared media excluded and unavailable video controls omitted');
    await send('Network.setBlockedURLs', { urls: ['*/_next/static/*.js*'] });
    await send('Network.setCacheDisabled', { cacheDisabled: true });
    await goto('/');
    assert.equal(await evaluate("document.querySelectorAll('[data-revealed]').length"), 0);
    assert.ok(await evaluate("[...document.querySelectorAll('#public-content [data-reveal]')].every(node => node.checkVisibility({ opacityProperty: true }) && getComputedStyle(node).opacity === '1')"));
    await send('Network.setBlockedURLs', { urls: [] });
    await send('Network.setCacheDisabled', { cacheDisabled: false });
    console.log('PASS homepage reveal content stays visible without application JavaScript');
    await goto("/does-not-exist");
    await wait("document.body.textContent.includes('Page not found')", "custom 404");
    assert.deepEqual(errors, [], "Unexpected browser errors");
    console.log("PASS custom 404 and no browser runtime errors");
    await send("Browser.close").catch(() => {});
  } finally {
    if (socket) socket.close();
    browser.kill();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
