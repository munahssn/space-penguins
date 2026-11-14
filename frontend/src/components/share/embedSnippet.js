const WIDTH = 560;
const HEIGHT = 720; // square player + its controls + the "open" link

const escapeAttribute = (text) => text.replaceAll("&", "&amp;").replaceAll('"', "&quot;");

/** HTML to paste into another page: an iframe showing `url` (a ?embed=1 link) in embed mode. */
export function embedSnippet(url) {
  return (
    `<iframe src="${escapeAttribute(url)}" width="${WIDTH}" height="${HEIGHT}" ` +
    `style="border:0;max-width:100%" title="SPHEREx Blink" loading="lazy"></iframe>`
  );
}
