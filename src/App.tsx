import { useEffect, useMemo, useState } from "react"
import {
  ArrowRight,
  CalendarPlus,
  Check,
  Copy,
  ExternalLink,
  Info,
  Plus,
  TrainFront,
  X,
} from "lucide-react"

import timetableData from "@/data/timetable.json"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type StationId = "sapporo" | "shin_sapporo" | "obihiro" | "kushiro"
type Direction = "eastbound" | "westbound"
type SeatClass = "reserved" | "green"
type SeatPosition = "window" | "aisle" | "either"
type TripType = "roundtrip" | "oneway"
type ServicePeriod = "ALL" | "AM" | "PM"

type Stop = {
  station: StationId
  label: string
  arrival: string | null
  departure: string | null
}

type Service = {
  id: string
  name: "おおぞら" | "とかち"
  number: number
  direction: Direction
  stops: Stop[]
}

type Timetable = {
  metadata: {
    effectiveFrom: string
    checkedAt: string
    officialSearchUrl: string
    operationInfoUrl: string
    sourceNote: string
  }
  services: Service[]
}

type Preference = {
  seatClass: SeatClass
  seatPosition: SeatPosition
}

type LegSelection = {
  period: ServicePeriod
  serviceId: string
  preference: Preference
}

const timetable = timetableData as Timetable
const stationLabels: Record<StationId, string> = {
  sapporo: "札幌",
  shin_sapporo: "新札幌",
  obihiro: "帯広",
  kushiro: "釧路",
}
const homeStations: StationId[] = ["sapporo", "shin_sapporo"]
const easternStations: StationId[] = ["obihiro", "kushiro"]
const defaultPreference: Preference = { seatClass: "reserved", seatPosition: "window" }

function dateForInput(offsetDays = 0) {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function formatDateJp(value: string) {
  if (!value) return "日付未選択"
  const date = new Date(`${value}T00:00:00`)
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date)
}

function formatMetadataDate(value: string) {
  return value.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$1年$2月$3日")
}

function getStop(service: Service, station: StationId) {
  return service.stops.find((stop) => stop.station === station)
}

function departureAt(service: Service, station: StationId) {
  const stop = getStop(service, station)
  return stop?.departure ?? stop?.arrival ?? null
}

function arrivalAt(service: Service, station: StationId) {
  const stop = getStop(service, station)
  return stop?.arrival ?? stop?.departure ?? null
}

function servicesFor(origin: StationId, destination: StationId) {
  const direction: Direction = homeStations.includes(origin) ? "eastbound" : "westbound"
  return timetable.services
    .filter((service) => service.direction === direction)
    .filter((service) => departureAt(service, origin) && arrivalAt(service, destination))
    .sort((left, right) => departureAt(left, origin)!.localeCompare(departureAt(right, origin)!))
}

function serviceLabel(service: Service, origin: StationId, destination: StationId) {
  return `${departureAt(service, origin)}発 → ${arrivalAt(service, destination)}着　${service.name}${service.number}号`
}

function servicesForPeriod(services: Service[], period: ServicePeriod, origin: StationId) {
  if (period === "ALL") return services
  return services.filter((service) => {
    const hour = Number(departureAt(service, origin)?.slice(0, 2))
    return period === "AM" ? hour < 12 : hour >= 12
  })
}

function preferenceLabel(preference: Preference) {
  const seatClass = preference.seatClass === "reserved" ? "指定席" : "グリーン車"
  const positions: Record<SeatPosition, string> = {
    window: "窓側",
    aisle: "通路側",
    either: "どちらでも可",
  }
  return `${seatClass}・${positions[preference.seatPosition]}`
}

function toCalendarDate(date: string, time: string) {
  return `${date.replaceAll("-", "")}T${time.replace(":", "")}00`
}

function buildGoogleCalendarUrl(
  date: string,
  service: Service,
  origin: StationId,
  destination: StationId,
  preference: Preference,
) {
  const title = `特急${service.name}${service.number}号 ${stationLabels[origin]}→${stationLabels[destination]}`
  const details = `乗車券・特急券\n${preferenceLabel(preference)}`
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${toCalendarDate(date, departureAt(service, origin)!)}/${toCalendarDate(date, arrivalAt(service, destination)!)}`,
    details,
    location: `${stationLabels[origin]}駅`,
    ctz: "Asia/Tokyo",
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

function escapeIcs(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll(";", "\\;").replaceAll(",", "\\,").replaceAll("\n", "\\n")
}

function foldIcsLine(line: string) {
  const encoder = new TextEncoder()
  const parts: string[] = []
  let current = ""
  for (const character of line) {
    const next = current + character
    const limit = parts.length === 0 ? 75 : 74
    if (encoder.encode(next).length > limit) {
      parts.push(current)
      current = character
    } else current = next
  }
  parts.push(current)
  return parts.join("\r\n ")
}

function buildIcs(
  events: Array<{
    date: string
    service: Service
    origin: StationId
    destination: StationId
    preference: Preference
  }>,
) {
  const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//train-request-tool//JA", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"]
  for (const event of events) {
    const title = `特急${event.service.name}${event.service.number}号 ${stationLabels[event.origin]}→${stationLabels[event.destination]}`
    lines.push(
      "BEGIN:VEVENT",
      `UID:${crypto.randomUUID()}@train-request-tool`,
      `DTSTAMP:${now}`,
      `DTSTART;TZID=Asia/Tokyo:${toCalendarDate(event.date, departureAt(event.service, event.origin)!)}`,
      `DTEND;TZID=Asia/Tokyo:${toCalendarDate(event.date, arrivalAt(event.service, event.destination)!)}`,
      `SUMMARY:${escapeIcs(title)}`,
      `DESCRIPTION:${escapeIcs(`乗車券・特急券\n${preferenceLabel(event.preference)}`)}`,
      `LOCATION:${escapeIcs(`${stationLabels[event.origin]}駅`)}`,
      "END:VEVENT",
    )
  }
  lines.push("END:VCALENDAR")
  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`
}

function isWindows() {
  return /Windows/i.test(navigator.userAgent)
}

function isIos() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
}

function StationSelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string
  label: string
  value: StationId
  options: StationId[]
  onChange: (value: StationId) => void
}) {
  return (
    <div className="min-w-0 flex-1 space-y-1">
      <Label htmlFor={id} className="text-xs lg:text-sm">{label}</Label>
      <Select value={value} onValueChange={(next) => onChange(next as StationId)}>
        <SelectTrigger id={id} className="w-full min-w-0" size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((station) => <SelectItem key={station} value={station}>{stationLabels[station]}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  )
}

function LegEditor({
  id,
  title,
  origin,
  destination,
  services,
  selection,
  onSelectionChange,
}: {
  id: string
  title: string
  origin: StationId
  destination: StationId
  services: Service[]
  selection: LegSelection
  onSelectionChange: (value: LegSelection) => void
}) {
  const displayedServices = servicesForPeriod(services, selection.period, origin)
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold lg:text-base">{title}</h3>
        <span className="text-muted-foreground text-sm">{stationLabels[origin]} → {stationLabels[destination]}</span>
      </div>
      <div className="flex gap-2">
        {(["ALL", "AM", "PM"] as const).map((period) => (
          <Button
            key={period}
            type="button"
            size="sm"
            className="lg:text-base"
            variant={selection.period === period ? "default" : "outline"}
            onClick={() => {
              const nextServices = servicesForPeriod(services, period, origin)
              onSelectionChange({
                ...selection,
                period,
                serviceId: nextServices.some((service) => service.id === selection.serviceId)
                  ? selection.serviceId
                  : nextServices[0]?.id ?? "",
              })
            }}
          >
            {period === "ALL" ? "すべて" : period === "AM" ? "午前" : "午後"}
          </Button>
        ))}
      </div>
      <div>
        <Select value={selection.serviceId} onValueChange={(serviceId) => onSelectionChange({ ...selection, serviceId })}>
          <SelectTrigger id={`${id}-service`} className="w-full min-w-0" size="sm"><SelectValue placeholder="列車を選択" /></SelectTrigger>
          <SelectContent>
            {displayedServices.map((service) => <SelectItem key={service.id} value={service.id}>{serviceLabel(service, origin, destination)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0 space-y-1">
          <Label htmlFor={`${id}-class`} className="text-xs lg:text-sm">座席種別</Label>
          <Select value={selection.preference.seatClass} onValueChange={(seatClass) => onSelectionChange({ ...selection, preference: { ...selection.preference, seatClass: seatClass as SeatClass } })}>
            <SelectTrigger id={`${id}-class`} className="w-full min-w-0" size="sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="reserved">指定席</SelectItem>
              <SelectItem value="green">グリーン車</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0 space-y-1">
          <Label htmlFor={`${id}-position`} className="text-xs lg:text-sm">座席位置</Label>
          <Select value={selection.preference.seatPosition} onValueChange={(seatPosition) => onSelectionChange({ ...selection, preference: { ...selection.preference, seatPosition: seatPosition as SeatPosition } })}>
            <SelectTrigger id={`${id}-position`} className="w-full min-w-0" size="sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="window">窓側</SelectItem>
              <SelectItem value="aisle">通路側</SelectItem>
              <SelectItem value="either">どちらでもよい</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [tripType, setTripType] = useState<TripType>("roundtrip")
  const [outboundOrigin, setOutboundOrigin] = useState<StationId>("sapporo")
  const [outboundDestination, setOutboundDestination] = useState<StationId>("obihiro")
  const [inboundStations, setInboundStations] = useState<{ origin: StationId; destination: StationId } | null>(null)
  const [departureDate, setDepartureDate] = useState(dateForInput())
  const [returnDate, setReturnDate] = useState(dateForInput(1))
  const [outbound, setOutbound] = useState<LegSelection>({ period: "AM", serviceId: "", preference: { ...defaultPreference } })
  const [inbound, setInbound] = useState<LegSelection>({ period: "PM", serviceId: "", preference: { ...defaultPreference } })
  const [copied, setCopied] = useState(false)

  const inboundOrigin = inboundStations?.origin ?? outboundDestination
  const inboundDestination = inboundStations?.destination ?? outboundOrigin
  const outboundServices = useMemo(() => servicesFor(outboundOrigin, outboundDestination), [outboundOrigin, outboundDestination])
  const inboundServices = useMemo(() => servicesFor(inboundOrigin, inboundDestination), [inboundOrigin, inboundDestination])

  useEffect(() => {
    setOutbound((current) => servicesForPeriod(outboundServices, current.period, outboundOrigin).some((service) => service.id === current.serviceId)
      ? current
      : { ...current, serviceId: servicesForPeriod(outboundServices, current.period, outboundOrigin)[0]?.id ?? "" })
  }, [outboundServices, outboundOrigin])
  useEffect(() => {
    setInbound((current) => servicesForPeriod(inboundServices, current.period, inboundOrigin).some((service) => service.id === current.serviceId)
      ? current
      : { ...current, serviceId: servicesForPeriod(inboundServices, current.period, inboundOrigin)[0]?.id ?? "" })
  }, [inboundServices, inboundOrigin])

  const message = useMemo(() => {
    const lines = ["お疲れ様です。", "以下のJR乗車券・特急券の手配をお願いします。", ""]
    const appendLeg = (title: string, date: string, origin: StationId, destination: StationId, selection: LegSelection, services: Service[]) => {
      const service = services.find((candidate) => candidate.id === selection.serviceId)
      lines.push(`【${title}】`, formatDateJp(date))
      if (service) {
        lines.push(`${stationLabels[origin]} ${departureAt(service, origin)}発 → ${stationLabels[destination]} ${arrivalAt(service, destination)}着`)
        lines.push(`特急${service.name}${service.number}号`, preferenceLabel(selection.preference))
      } else lines.push("列車未選択")
    }
    appendLeg(tripType === "roundtrip" ? "往路" : "片道", departureDate, outboundOrigin, outboundDestination, outbound, outboundServices)
    if (tripType === "roundtrip") {
      lines.push("")
      appendLeg("復路", returnDate, inboundOrigin, inboundDestination, inbound, inboundServices)
    }
    return lines.join("\n")
  }, [tripType, departureDate, returnDate, outboundOrigin, outboundDestination, inboundOrigin, inboundDestination, outbound, inbound, outboundServices, inboundServices])

  const selectedEvents = useMemo(() => {
    const events: Array<{ date: string; service: Service; origin: StationId; destination: StationId; preference: Preference }> = []
    const outboundService = outboundServices.find((service) => service.id === outbound.serviceId)
    if (outboundService) events.push({ date: departureDate, service: outboundService, origin: outboundOrigin, destination: outboundDestination, preference: outbound.preference })
    const inboundService = inboundServices.find((service) => service.id === inbound.serviceId)
    if (tripType === "roundtrip" && inboundService) events.push({ date: returnDate, service: inboundService, origin: inboundOrigin, destination: inboundDestination, preference: inbound.preference })
    return events
  }, [tripType, departureDate, returnDate, outboundOrigin, outboundDestination, inboundOrigin, inboundDestination, outbound, inbound, outboundServices, inboundServices])

  async function copyMessage() {
    await navigator.clipboard.writeText(message)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  function addToCalendar() {
    if (isWindows()) {
      for (const event of selectedEvents) window.open(buildGoogleCalendarUrl(event.date, event.service, event.origin, event.destination, event.preference), "_blank", "noopener,noreferrer")
      return
    }
    const blob = new Blob([buildIcs(selectedEvents)], { type: "text/calendar;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    if (isIos()) window.location.href = url
    else {
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = "jr-trip.ics"
      anchor.click()
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  const actionButtons = (
    <>
      <Button type="button" className="flex-1" onClick={copyMessage}>{copied ? <Check /> : <Copy />}{copied ? "コピーしました" : "メッセージをコピー"}</Button>
      <Button type="button" variant="outline" className="flex-1" disabled={selectedEvents.length === 0} onClick={addToCalendar}><CalendarPlus />カレンダー登録</Button>
    </>
  )

  return (
    <div className="min-h-dvh bg-gradient-to-b from-teal-50 to-background pb-24 lg:pb-8">
      <header className="border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-center gap-3 px-4 py-4 text-center">
          <TrainFront className="size-5 shrink-0 text-teal-700 lg:size-6" />
          <h1 className="text-lg font-bold lg:text-2xl">JR特急予約依頼メッセージ作成ツール</h1>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-4 py-5">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm">
          <span className="flex items-center gap-1.5"><Info className="size-4 text-teal-700" />ダイヤ確認日：{formatMetadataDate(timetable.metadata.checkedAt)}</span>
          <div className="flex gap-3">
            <a href={timetable.metadata.officialSearchUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-teal-800 underline underline-offset-2">公式時刻検索<ExternalLink className="size-3.5" /></a>
            <a href={timetable.metadata.operationInfoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-teal-800 underline underline-offset-2">運行情報<ExternalLink className="size-3.5" /></a>
          </div>
        </div>

        <div className="grid items-stretch gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <Card className="gap-3 py-3">
            <CardContent className="space-y-3 px-3">
              <div className="flex gap-2">
                <Button type="button" className="flex-1 lg:text-base" size="sm" variant={tripType === "roundtrip" ? "default" : "outline"} onClick={() => setTripType("roundtrip")}>往復</Button>
                <Button type="button" className="flex-1 lg:text-base" size="sm" variant={tripType === "oneway" ? "default" : "outline"} onClick={() => setTripType("oneway")}>片道</Button>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="min-w-0 space-y-1">
                  <Label htmlFor="departure-date" className="text-xs lg:text-sm">出発日</Label>
                  <Input id="departure-date" type="date" value={departureDate} onChange={(event) => setDepartureDate(event.target.value)} className="h-7 min-w-0 px-2 py-1 text-sm lg:text-base" />
                </div>
                {tripType === "roundtrip" && (
                  <div className="min-w-0 space-y-1">
                    <Label htmlFor="return-date" className="text-xs lg:text-sm">帰着日</Label>
                    <Input id="return-date" type="date" value={returnDate} onChange={(event) => setReturnDate(event.target.value)} className="h-7 min-w-0 px-2 py-1 text-sm lg:text-base" />
                  </div>
                )}
              </div>

              <div className="flex min-w-0 items-end gap-2">
                <StationSelect id="outbound-origin" label="乗車駅" value={outboundOrigin} options={homeStations} onChange={setOutboundOrigin} />
                <ArrowRight className="mb-1 size-5 shrink-0 text-muted-foreground" />
                <StationSelect id="outbound-destination" label="降車駅" value={outboundDestination} options={easternStations} onChange={setOutboundDestination} />
              </div>

              <section className="space-y-3 border-t pt-3">
                <LegEditor id="outbound" title="往路" origin={outboundOrigin} destination={outboundDestination} services={outboundServices} selection={outbound} onSelectionChange={setOutbound} />
              </section>

              {tripType === "roundtrip" && (
                <section className="space-y-3 border-t pt-3">
                  {inboundStations ? (
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-sm font-medium">帰りの駅を個別に選択</span>
                        <Button type="button" variant="ghost" size="icon-sm" onClick={() => setInboundStations(null)} aria-label="帰りの駅の個別設定を解除"><X /></Button>
                      </div>
                      <div className="flex min-w-0 items-end gap-2">
                        <StationSelect id="inbound-origin" label="復路の乗車駅" value={inboundStations.origin} options={easternStations} onChange={(origin) => setInboundStations({ ...inboundStations, origin })} />
                        <ArrowRight className="mb-2.5 size-5 shrink-0 text-muted-foreground" />
                        <StationSelect id="inbound-destination" label="復路の降車駅" value={inboundStations.destination} options={homeStations} onChange={(destination) => setInboundStations({ ...inboundStations, destination })} />
                      </div>
                    </div>
                  ) : (
                    <Button type="button" variant="outline" size="sm" onClick={() => setInboundStations({ origin: outboundDestination, destination: outboundOrigin })}>
                      <Plus />帰りの駅を個別に変更
                    </Button>
                  )}
                  <LegEditor id="inbound" title="復路" origin={inboundOrigin} destination={inboundDestination} services={inboundServices} selection={inbound} onSelectionChange={setInbound} />
                </section>
              )}
            </CardContent>
          </Card>

          <Card className="lg:flex lg:flex-col">
            <CardHeader><CardTitle>メッセージプレビュー</CardTitle></CardHeader>
            <CardContent className="lg:flex lg:flex-1 lg:flex-col">
              <pre className="min-h-80 flex-1 whitespace-pre-wrap rounded-lg bg-muted p-4 font-sans text-sm leading-relaxed text-foreground lg:text-base">{message}</pre>
              <p className="mt-3 text-xs text-muted-foreground">ご乗車前に、JR北海道公式サイトで最新の時刻・運行情報をご確認ください。</p>
              <div className="mt-4 hidden gap-2 lg:flex">{actionButtons}</div>
            </CardContent>
          </Card>
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 flex gap-2 border-t bg-white/95 p-3 shadow-lg backdrop-blur lg:hidden">{actionButtons}</div>
    </div>
  )
}
