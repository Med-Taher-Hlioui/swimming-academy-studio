import assert from "node:assert/strict";
import { test } from "node:test";
import { publicSiteConfig as site, publicDesignCopy as design } from "../src/config/public-site";
import { trialAudiences, trialLevels, trialMessage, trialRequestLink } from "../src/features/public-site/trial-request-model";

test("all eight audience/level selections produce the matching French WhatsApp request", () => {
  assert.deepEqual(trialAudiences.map(option => option.value), ["child", "adult"]);
  assert.deepEqual(trialLevels.map(option => option.value), ["unknown", "beginner", "intermediate", "advanced"]);
  for (const audience of trialAudiences) for (const level of trialLevels) {
    const message = trialMessage(audience.value, level.value, site.trial.message)!;
    const url = new URL(trialRequestLink(site.contact.whatsappNumber, audience.value, level.value, site.trial.message)!);
    assert.equal(url.origin, "https://wa.me");
    assert.equal(url.pathname, "/21650765765");
    assert.equal(url.searchParams.get("text"), message);
    assert.ok(message.includes(`Public : ${audience.label}`));
    assert.ok(message.includes(`Niveau estimé : ${level.label}`));
    assert.match(message, /séance d'essai gratuite/);
    assert.match(message, /Quels horaires.*selon les disponibilités/);
    assert.equal(message.split("\n").length, 4);
    assert.equal([...url.searchParams.keys()].join(), "text");
  }
});

test("missing and arbitrary personal-text selections cannot produce a request", () => {
  for (const audience of ["", "under-three", "Nom personnel", "child\nEmail: person@example.test"]) {
    assert.equal(trialRequestLink(site.contact.whatsappNumber, audience, "unknown", site.trial.message), null);
  }
  for (const level of ["", "phone", "person@example.test", "advanced\nNom: test"]) {
    assert.equal(trialMessage("adult", level, site.trial.message), null);
  }
  assert.equal(trialRequestLink(null, "adult", "unknown", site.trial.message), null);
});

test("free-trial and variable-hours copy does not promise a booking or publish prices", () => {
  assert.equal(site.hero.primaryAction, "Séance d'essai gratuite");
  assert.equal(site.programSection.action, site.hero.primaryAction);
  assert.equal(site.trial.scheduleLabel, "Horaires selon les disponibilités");
  assert.match(site.programSection.pendingDetails, /Horaires selon les disponibilités/);
  assert.match(site.programSection.description, /groupe d’âge et niveau/);
  assert.match(site.trial.disclaimer, /Aucun créneau n’est réservé ou confirmé/);
  assert.match(site.trial.classificationNote, /ne désignent pas des catégories de groupes officiellement proposées/);
  assert.doesNotMatch(JSON.stringify(site), /\d+\s*(?:€|TND|DT|dinars)/i);
});

test("programme enquiries reuse validated choices and keep their context separate from trial requests", () => {
  const copy = { ...site.trial.message, opening: design.explorer.opening, availability: design.explorer.availability };
  for (const audience of trialAudiences) for (const level of trialLevels) {
    const link = trialRequestLink(site.contact.whatsappNumber, audience.value, level.value, copy)!;
    const text = new URL(link).searchParams.get("text")!;
    assert.ok(text.includes(audience.label));
    assert.ok(text.includes(level.label));
    assert.match(text, /programmes de natation/);
    assert.doesNotMatch(text, /séance d'essai/);
  }
  assert.equal(trialRequestLink(site.contact.whatsappNumber, "name@example.test", "unknown", copy), null);
});
