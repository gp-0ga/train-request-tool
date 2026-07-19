import { readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const csvPath = resolve(root, "data/timetable-source.csv")
const metadataPath = resolve(root, "data/timetable-metadata.json")
const outputPath = resolve(root, "src/data/timetable.json")
const stations = ["sapporo", "shin_sapporo", "obihiro", "kushiro"]
const stationLabels = { sapporo: "札幌", shin_sapporo: "新札幌", obihiro: "帯広", kushiro: "釧路" }

function parseCsv(text) {
  const rows = []
  let row = []
  let field = ""
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (char === '"') quoted = false
      else field += char
    } else if (char === '"') quoted = true
    else if (char === ",") {
      row.push(field.trim())
      field = ""
    } else if (char === "\n") {
      row.push(field.trim())
      if (row.some(Boolean)) rows.push(row)
      row = []
      field = ""
    } else if (char !== "\r") field += char
  }
  row.push(field.trim())
  if (row.some(Boolean)) rows.push(row)
  const [headers, ...values] = rows
  if (!headers) throw new Error("CSVが空です")
  return values.map((cells, rowIndex) => {
    if (cells.length !== headers.length) {
      throw new Error(`CSV ${rowIndex + 2}行目: 列数が${cells.length}です（必要: ${headers.length}）`)
    }
    return Object.fromEntries(headers.map((header, index) => [header, cells[index]]))
  })
}

function timeToMinutes(value) {
  const [hours, minutes] = value.split(":").map(Number)
  return hours * 60 + minutes
}

function validateTime(value, label, errors) {
  if (value && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    errors.push(`${label}: 時刻「${value}」はHH:mm形式ではありません`)
  }
}

function validateService(service, errors) {
  if (!/^(ozora|tokachi)-\d+$/.test(service.id)) errors.push(`${service.id}: ID形式が不正です`)
  if (!["おおぞら", "とかち"].includes(service.name)) errors.push(`${service.id}: 列車名が不正です`)
  if (!Number.isInteger(service.number) || service.number < 1) errors.push(`${service.id}: 号数が不正です`)
  if (!["eastbound", "westbound"].includes(service.direction)) errors.push(`${service.id}: 方向が不正です`)

  const stopMap = Object.fromEntries(service.stops.map((stop) => [stop.station, stop]))
  for (const station of ["sapporo", "shin_sapporo", "obihiro"]) {
    if (!stopMap[station]) errors.push(`${service.id}: ${stationLabels[station]}の時刻がありません`)
  }
  if (service.name === "おおぞら" && !stopMap.kushiro) errors.push(`${service.id}: 釧路の時刻がありません`)
  if (service.name === "とかち" && stopMap.kushiro) errors.push(`${service.id}: とかちに釧路時刻が入っています`)
  if (service.direction === "eastbound" && service.number % 2 === 0) errors.push(`${service.id}: 下り列車の号数が偶数です`)
  if (service.direction === "westbound" && service.number % 2 !== 0) errors.push(`${service.id}: 上り列車の号数が奇数です`)

  for (const stop of service.stops) {
    validateTime(stop.arrival ?? "", `${service.id}/${stop.label}/着`, errors)
    validateTime(stop.departure ?? "", `${service.id}/${stop.label}/発`, errors)
  }
  const route = service.direction === "eastbound"
    ? ["sapporo", "shin_sapporo", "obihiro", "kushiro"]
    : ["kushiro", "obihiro", "shin_sapporo", "sapporo"]
  const journeyTimes = route
    .map((station) => stopMap[station])
    .filter(Boolean)
    .map((stop) => stop.departure ?? stop.arrival)
    .filter(Boolean)
  for (let index = 1; index < journeyTimes.length; index += 1) {
    if (timeToMinutes(journeyTimes[index]) <= timeToMinutes(journeyTimes[index - 1])) {
      errors.push(`${service.id}: 運行順の時刻が逆転しています（${journeyTimes[index - 1]} → ${journeyTimes[index]}）`)
    }
  }
}

async function buildTimetable() {
  const [csv, metadataText] = await Promise.all([readFile(csvPath, "utf8"), readFile(metadataPath, "utf8")])
  const metadata = JSON.parse(metadataText.replace(/^\uFEFF/, ""))
  const rows = parseCsv(csv.replace(/^\uFEFF/, ""))
  const services = rows.map((row) => ({
    id: row.id,
    name: row.name,
    number: Number(row.number),
    direction: row.direction,
    stops: stations.flatMap((station) => {
      const arrival = row[`${station}_arrival`] || null
      const departure = row[`${station}_departure`] || null
      return arrival || departure ? [{ station, label: stationLabels[station], arrival, departure }] : []
    }),
  }))

  const errors = []
  if (metadata.schemaVersion !== 1) errors.push("metadata: schemaVersionは1にしてください")
  for (const key of ["effectiveFrom", "checkedAt"]) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(metadata[key] ?? "")) errors.push(`metadata: ${key}はYYYY-MM-DD形式にしてください`)
  }
  for (const key of ["officialSearchUrl", "operationInfoUrl"]) {
    if (!/^https:\/\//.test(metadata[key] ?? "")) errors.push(`metadata: ${key}にはHTTPS URLが必要です`)
  }
  const ids = new Set()
  for (const service of services) {
    if (ids.has(service.id)) errors.push(`${service.id}: IDが重複しています`)
    ids.add(service.id)
    validateService(service, errors)
  }
  if (!services.some((service) => service.direction === "eastbound")) errors.push("下り列車がありません")
  if (!services.some((service) => service.direction === "westbound")) errors.push("上り列車がありません")
  if (errors.length) throw new Error(`時刻表の検証に失敗しました:\n- ${errors.join("\n- ")}`)
  return { metadata, services }
}

const timetable = await buildTimetable()
const generated = `${JSON.stringify(timetable, null, 2)}\n`
if (process.argv.includes("--check")) {
  const existing = await readFile(outputPath, "utf8").catch(() => "")
  if (existing !== generated) {
    console.error("src/data/timetable.jsonが入力CSVと一致しません。npm run timetable:generateを実行してください。")
    process.exitCode = 1
  } else console.log(`時刻表OK: ${timetable.services.length}列車、確認日 ${timetable.metadata.checkedAt}`)
} else {
  await writeFile(outputPath, generated, "utf8")
  console.log(`src/data/timetable.jsonを生成しました（${timetable.services.length}列車）`)
}
