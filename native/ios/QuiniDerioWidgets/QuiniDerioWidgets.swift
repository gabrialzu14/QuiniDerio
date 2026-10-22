import SwiftUI
import WidgetKit
import AppIntents

struct JornadaEntry: TimelineEntry {
    let date: Date
    let snapshot: JornadaSnapshot?
    let offline: Bool
    let icons: [String: Data]
}
struct JornadaProvider: TimelineProvider {
    func placeholder(in context: Context) -> JornadaEntry { JornadaEntry(date: .now, snapshot: nil, offline: false, icons: [:]) }
    func getSnapshot(in context: Context, completion: @escaping (JornadaEntry) -> Void) { completion(JornadaEntry(date: .now, snapshot: JornadaStore.read(), offline: false, icons: JornadaStore.icons())) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<JornadaEntry>) -> Void) {
        Task {
            let (snapshot, offline) = await JornadaStore.fetch()
            let icons = await JornadaStore.loadIcons(snapshot?.matches ?? [])
            let entry = JornadaEntry(date: .now, snapshot: snapshot, offline: offline, icons: icons)
            // A request, not an exact refresh promise: WidgetKit owns the reload budget.
            completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(15 * 60))))
        }
    }
}
struct MoveMatch: AppIntent {
    static var title: LocalizedStringResource = "Cambiar partido"
    static var openAppWhenRun: Bool = false
    @Parameter(title: "Formato") var kind: String
    @Parameter(title: "Paso") var step: Int
    init() {}
    init(kind: String, step: Int) { self.kind = kind; self.step = step }
    func perform() async throws -> some IntentResult {
        guard ["compact", "full"].contains(kind), abs(step) <= 7 else { return .result() }
        JornadaStore.move(kind, step: step)
        WidgetCenter.shared.reloadTimelines(ofKind: kind == "compact" ? "QuiniDerioCompact" : "QuiniDerioFull")
        return .result()
    }
}
struct RefreshJornada: AppIntent {
    static var title: LocalizedStringResource = "Actualizar jornada"
    static var openAppWhenRun: Bool = false
    func perform() async throws -> some IntentResult { let _ = await JornadaStore.fetch(); WidgetCenter.shared.reloadAllTimelines(); return .result() }
}
struct ClubCrest: View {
    let raw: String?
    let name: String
    let icons: [String: Data]
    var body: some View {
        Group {
            if let raw, let data = icons[raw], let image = UIImage(data: data) { Image(uiImage: image).resizable().scaledToFit() }
            else { Text(String(name.prefix(2))).font(.system(size: 9, weight: .bold)).foregroundStyle(.secondary) }
        }.frame(width: 22, height: 24).accessibilityHidden(true)
    }
}
struct MatchLine: View {
    let match: JornadaMatch
    let icons: [String: Data]
    var body: some View {
        HStack(spacing: 3) {
            ClubCrest(raw: match.homeCrest, name: match.home, icons: icons)
            Text(match.home).font(.system(size: 11, weight: .medium)).lineLimit(2).frame(maxWidth: .infinity, alignment: .center)
            VStack(spacing: 1) {
                Text(match.statusLabel).font(.system(size: 8)).foregroundStyle(match.status == "live" || match.status == "halftime" ? Color.red : Color.secondary)
                Text(match.result).font(.system(size: 16, weight: .bold)).monospacedDigit()
                if !match.date.isEmpty { Text(match.date).font(.system(size: 8)).foregroundStyle(.secondary) }
            }.frame(width: 64)
            Text(match.away).font(.system(size: 11, weight: .medium)).lineLimit(2).frame(maxWidth: .infinity, alignment: .center)
            ClubCrest(raw: match.awayCrest, name: match.away, icons: icons)
        }.frame(minHeight: 34).accessibilityElement(children: .combine)
    }
}
struct CompactMatch: View {
    let match: JornadaMatch
    let icons: [String: Data]
    var body: some View {
        HStack(spacing: 3) {
            VStack(spacing: 2) { ClubCrest(raw: match.homeCrest, name: match.home, icons: icons); Text(match.home).font(.system(size: 10, weight: .medium)).lineLimit(2).multilineTextAlignment(.center) }.frame(maxWidth: .infinity)
            VStack(spacing: 2) { Text(match.result).font(.system(size: 18, weight: .bold)).monospacedDigit(); Text(match.statusLabel).font(.system(size: 8)).foregroundStyle(match.status == "live" ? Color.red : Color.secondary) }.frame(width: 58)
            VStack(spacing: 2) { ClubCrest(raw: match.awayCrest, name: match.away, icons: icons); Text(match.away).font(.system(size: 10, weight: .medium)).lineLimit(2).multilineTextAlignment(.center) }.frame(maxWidth: .infinity)
        }.accessibilityElement(children: .combine)
    }
}
struct JornadaView: View {
    let entry: JornadaEntry
    let compact: Bool
    @Environment(\.widgetFamily) var family
    var kind: String { compact ? "compact" : "full" }
    var rows: Int { compact ? 1 : family == .systemLarge ? 7 : 2 }
    var matches: [JornadaMatch] { entry.snapshot?.matches ?? [] }
    var index: Int { JornadaStore.selected(kind, matches: matches) }
    var start: Int { compact ? index : (index / rows) * rows }
    var body: some View {
        VStack(spacing: 4) {
            HStack {
                Link("QuiniDerio", destination: JornadaStore.appURL(URL(string: "https://quiniderio.vercel.app/")!)).font(.system(size: 12, weight: .bold))
                Spacer(minLength: 2)
                if let s = entry.snapshot { Text("J\(s.round)").font(.system(size: 10)).foregroundStyle(.secondary) }
            }
            if matches.isEmpty { Text("Pulsa actualizar para consultar la jornada").font(.caption).multilineTextAlignment(.center).frame(maxHeight: .infinity) }
            else {
                ForEach(Array(matches.dropFirst(start).prefix(rows))) { m in
                    Link(destination: m.appDestination) {
                        if compact { CompactMatch(match: m, icons: entry.icons) }
                        else { MatchLine(match: m, icons: entry.icons) }
                    }.tint(.primary)
                }
                Spacer(minLength: 0)
            }
            HStack(spacing: 3) {
                Button(intent: MoveMatch(kind: kind, step: -rows)) { Image(systemName: "chevron.left").frame(minWidth: 28, minHeight: 24) }.accessibilityLabel("Anterior")
                Spacer(minLength: 0)
                Text(matches.isEmpty ? "Sin datos" : compact ? "\(start + 1) de \(matches.count)" : "\(start + 1)–\(min(start + rows, matches.count)) de \(matches.count)").font(.system(size: 9))
                Spacer(minLength: 0)
                Button(intent: MoveMatch(kind: kind, step: rows)) { Image(systemName: "chevron.right").frame(minWidth: 28, minHeight: 24) }.accessibilityLabel("Siguiente")
                Button(intent: RefreshJornada()) { Image(systemName: "arrow.clockwise").frame(minWidth: 24, minHeight: 24) }.accessibilityLabel("Actualizar resultados")
            }.buttonStyle(.plain).font(.system(size: 12))
            if let s = entry.snapshot {
                Text((entry.offline ? "Sin conexión · " : "Consultado ") + JornadaStore.consulted(s.fetchedAt)).font(.system(size: 8)).foregroundStyle(.secondary).lineLimit(1)
            }
        }
        .containerBackground(for: .widget) { Color(.systemBackground).overlay(Color.blue.opacity(0.09)) }
    }
}
struct QuiniDerioCompact: Widget {
    let kind = "QuiniDerioCompact"
    var body: some WidgetConfiguration { StaticConfiguration(kind: kind, provider: JornadaProvider()) { JornadaView(entry: $0, compact: true) }.configurationDisplayName("Partido a partido").description("Recorre toda la jornada con las flechas.").supportedFamilies([.systemSmall, .systemMedium]) }
}
struct QuiniDerioFull: Widget {
    let kind = "QuiniDerioFull"
    var body: some WidgetConfiguration { StaticConfiguration(kind: kind, provider: JornadaProvider()) { JornadaView(entry: $0, compact: false) }.configurationDisplayName("Jornada completa").description("Todos los resultados. En tamaño mediano, cambia de página.").supportedFamilies([.systemMedium, .systemLarge]) }
}
@main
struct QuiniDerioWidgets: WidgetBundle {
    var body: some Widget { QuiniDerioFull(); QuiniDerioCompact() }
}
