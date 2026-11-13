import assert from "node:assert/strict";
import { test } from "node:test";
import { publicSiteConfig, publicVenue } from "../src/config/public-site";
import { venueDirections, venueEmbed } from "../src/features/public-site/location-links";

test("hotel destinations preserve owner feature identifier and use address-based directions", () => {
  const canonical = new URL(publicSiteConfig.contact.mapsUrl!);
  assert.equal(canonical.searchParams.get("ftid"), publicVenue.featureId);
  const directions = new URL(venueDirections(publicVenue.destination));
  assert.equal(directions.pathname, "/maps/dir/");
  assert.equal(directions.searchParams.get("api"), "1");
  assert.equal(directions.searchParams.get("destination"), publicVenue.destination);
  assert.equal(directions.searchParams.has("destination_place_id"), false);
});

test("map embeds use verified hotel coordinates without credentials or a commercial place card", () => {
  const embed = new URL(venueEmbed(publicVenue.embedCoordinates));
  assert.equal(embed.origin, "https://www.google.com");
  assert.equal(embed.searchParams.get("q"), "35.7671468,10.7198879");
  assert.equal(embed.searchParams.has("ftid"), false);
  assert.equal(embed.searchParams.get("output"), "embed");
  assert.equal(embed.searchParams.has("key"), false);
  assert.equal(embed.searchParams.has("ll"), false);
});
