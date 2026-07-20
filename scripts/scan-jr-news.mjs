const parts = Object.fromEntries(
  new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric" })
    .formatToParts(new Date())
    .filter((part) => part.type !== "literal")
    .map((part) => [part.type, Number(part.value)]),
)
const targetYear = parts.month >= 4 ? parts.year + 1 : parts.year
const fiscalYear = targetYear - 1
const pageUrl = `https://www.jrhokkaido.co.jp/CM/Info/press/${fiscalYear}.html`

if (process.argv.includes("--simulate")) {
  const repository = process.env.GITHUB_REPOSITORY ?? "gp-0ga/train-request-tool"
  const runId = process.env.GITHUB_RUN_ID ?? `local-${Date.now()}`
  console.log(JSON.stringify([{
    title: `[模擬] ${targetYear}年3月ダイヤ改正`,
    url: `https://github.com/${repository}/actions/runs/${runId}`,
    targetYear,
    checkedPage: "模擬データ（JR北海道公式サイトにはアクセスしていません）",
    simulation: true,
  }], null, 2))
  process.exit(0)
}

function normalize(text) {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[０-９]/g, (character) => String.fromCharCode(character.charCodeAt(0) - 0xfee0))
    .replace(/\s+/g, " ")
    .trim()
}

const response = await fetch(pageUrl, { headers: { "user-agent": "train-request-tool timetable-change monitor" } })
if (!response.ok) throw new Error(`JR北海道ニュースリリースを取得できません: ${response.status} ${pageUrl}`)
const html = await response.text()
const announcements = []
const seen = new Set()
const linkPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
for (const match of html.matchAll(linkPattern)) {
  const title = normalize(match[2])
  if (!title.includes("ダイヤ改正") || !title.includes(`${targetYear}年`)) continue
  const url = new URL(match[1], pageUrl).href
  if (seen.has(url)) continue
  seen.add(url)
  announcements.push({ title, url, targetYear, checkedPage: pageUrl })
}

console.log(JSON.stringify(announcements, null, 2))
