import Foundation
import UIKit

struct JornadaMatch: Codable, Identifiable {
    let id: String
    let team: String
    let home: String
    let away: String
    let homeCrest: String?
    let awayCrest: String?
    let homeScore: Int?
    let awayScore: Int?
    let status: String
    let statusLabel: String
    let kickoff: String?
    let date: String
    let time: String
    let url: String
    var result: String {
        if let h = homeScore, let a = awayScore { return "\(h) – \(a)" }
        return status == "scheduled" && !time.isEmpty ? time : "—"
    }
    var destination: URL { URL(string: url) ?? URL(string: "https://quiniderio.vercel.app/widgets")! }
    var appDestination: URL { JornadaStore.appURL(destination) }
}
struct JornadaSnapshot: Codable {
    let version: Int
    let round: Int
    let fetchedAt: String
    let sourceUpdatedAt: String?
    let matches: [JornadaMatch]
    let url: String
}
enum JornadaStore {
    static let suite = "group.com.quiniderio.widgets"
    static var defaults: UserDefaults { UserDefaults(suiteName: suite) ?? .standard }
    static func read() -> JornadaSnapshot? {
        guard let data = defaults.data(forKey: "snapshot-v1") else { return nil }
        return try? JSONDecoder().decode(JornadaSnapshot.self, from: data)
    }
    static func save(_ snapshot: JornadaSnapshot) {
        if read()?.round != snapshot.round {
            defaults.removeObject(forKey: "selected-compact")
            defaults.removeObject(forKey: "selected-full")
        }
        if let data = try? JSONEncoder().encode(snapshot) { defaults.set(data, forKey: "snapshot-v1") }
    }
    static func selected(_ kind: String, matches: [JornadaMatch]) -> Int {
        let saved = defaults.string(forKey: "selected-\(kind)")
        return matches.firstIndex { $0.id == saved } ?? 0
    }
    static func move(_ kind: String, step: Int) {
        guard let s = read(), !s.matches.isEmpty else { return }
        let index = selected(kind, matches: s.matches)
        let next: Int
        if kind == "full", step != 0 {
            let rows = abs(step), pages = (s.matches.count + rows - 1) / rows
            let page = ((index / rows + (step > 0 ? 1 : -1)) % pages + pages) % pages
            next = page * rows
        } else { next = ((index + step) % s.matches.count + s.matches.count) % s.matches.count }
        defaults.set(s.matches[next].id, forKey: "selected-\(kind)")
    }
    static func trusted(_ url: URL) -> Bool {
        url.scheme == "https" && url.host == "quiniderio.vercel.app" && (url.port == nil || url.port == 443)
    }
    static func appURL(_ target: URL) -> URL {
        var c = URLComponents(); c.scheme = "quiniderio"; c.host = "open"
        c.queryItems = [URLQueryItem(name: "url", value: target.absoluteString)]
        return c.url!
    }
    static func imageURL(_ raw: String) -> URL? {
        guard let url = URL(string: raw), trusted(url), url.path == "/api/widgets/crest" else { return nil }
        return url
    }
    static var directory: URL? { FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: suite) }
    // Key is the actual URL, including the crest revision; cache size is bounded to 32 icons.
    static func icons() -> [String: Data] {
        guard let path = directory?.appendingPathComponent("crests.json"), let data = try? Data(contentsOf: path) else { return [:] }
        return (try? JSONDecoder().decode([String: Data].self, from: data)) ?? [:]
    }
    static func loadIcons(_ matches: [JornadaMatch]) async -> [String: Data] {
        var cached = icons()
        let needed = Set(matches.flatMap { [$0.homeCrest, $0.awayCrest].compactMap { $0 } })
        cached = cached.filter { needed.contains($0.key) }
        await withTaskGroup(of: (String, Data?).self) { group in
            for raw in needed where cached[raw] == nil {
                guard let url = imageURL(raw) else { continue }
                group.addTask {
                    var request = URLRequest(url: url); request.timeoutInterval = 5
                    guard let (data, response) = try? await URLSession.shared.data(for: request), (response as? HTTPURLResponse)?.statusCode == 200, data.count < 65536, UIImage(data: data) != nil else { return (raw, nil) }
                    return (raw, data)
                }
            }
            for await (raw, data) in group { if let data { cached[raw] = data } }
        }
        if let path = directory?.appendingPathComponent("crests.json"), let data = try? JSONEncoder().encode(cached) { try? data.write(to: path, options: .atomic) }
        return cached
    }
    static func fetch() async -> (JornadaSnapshot?, Bool) {
        var request = URLRequest(url: URL(string: "https://quiniderio.vercel.app/api/widgets")!)
        request.timeoutInterval = 8
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard (response as? HTTPURLResponse)?.statusCode == 200, data.count < 262144 else { return (read(), true) }
            let value = try JSONDecoder().decode(JornadaSnapshot.self, from: data)
            guard value.version == 1, value.round > 0, !value.matches.isEmpty, value.matches.count <= 7 else { return (read(), true) }
            save(value)
            return (value, false)
        } catch { return (read(), true) }
    }
    static func consulted(_ raw: String) -> String {
        let iso = ISO8601DateFormatter(); iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = iso.date(from: raw) else { return "Sin fecha" }
        let f = DateFormatter(); f.dateFormat = "dd/MM HH:mm"; f.timeZone = TimeZone(identifier: "Europe/Madrid")
        return f.string(from: date)
    }
}
