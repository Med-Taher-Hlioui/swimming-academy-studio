/** Return no link for absent/invalid editorial input; never fall back to an invented contact. */
export function instagramLink(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !["instagram.com", "www.instagram.com"].includes(url.hostname) || url.username || url.password || url.port) return null;
    if (!/^\/[a-zA-Z0-9_.]{1,30}\/?$/.test(url.pathname)) return null;
    return `https://www.instagram.com${url.pathname.replace(/\/$/, "")}/`;
  } catch { return null; }
}

export function whatsappLink(number: string | null, message: string): string | null {
  if (!number || !/^[1-9]\d{6,14}$/.test(number)) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
