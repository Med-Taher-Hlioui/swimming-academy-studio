import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { publicMedia } from "../src/config/public-media";
import { publicSiteConfig } from "../src/config/public-site";

test("Preview includes labeled placeholders without uncleared photographs", () => {
  assert.equal(Object.keys(publicMedia.photos).length, 6);
  for (const photo of Object.values(publicMedia.photos)) {
    assert.equal(photo.placeholder, true);
    assert.equal(photo.approval.status, "placeholder");
    assert.equal(photo.url, "");
    assert.equal(photo.fallbackUrl, "");
    assert.equal(photo.bytes, 0);
    assert.deepEqual(photo.variants, []);
    assert.match(photo.alt, /provisoire/);
  }
  assert.doesNotMatch(JSON.stringify(publicMedia), /[A-Z]:\\|sourcePath|shutterstock|\/media\//i);
});

test("Preview cannot publish original portraits, logo or public media directories", () => {
  assert.equal(publicSiteConfig.brand.logo, null);
  assert.ok(publicSiteConfig.coaches.every(coach => !coach.photo));
  assert.equal(existsSync("public/brand"), false);
  assert.equal(existsSync("public/media"), false);
});

test("omitted videos have no source, poster or pretend playback", () => {
  for (const video of Object.values(publicMedia.videos)) {
    assert.equal(video.available, false);
    assert.equal(video.url, "");
    assert.equal(video.poster, "");
    assert.equal(video.bytes, 0);
    assert.equal(video.posterBytes, 0);
  }
});
