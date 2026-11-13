export function venueDirections(destination: string) {
  return `https://www.google.com/maps/dir/?${new URLSearchParams({ api: "1", destination })}`;
}

export function venueEmbed(verifiedCoordinates: string) {
  return `https://www.google.com/maps?${new URLSearchParams({ q: verifiedCoordinates, output: "embed", hl: "fr", z: "16" })}`;
}
