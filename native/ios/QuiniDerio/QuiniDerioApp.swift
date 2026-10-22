import SwiftUI
import WebKit
import WidgetKit

@main
struct QuiniDerioApp: App {
    @State private var target = URL(string: "https://quiniderio.vercel.app/")!
    var body: some Scene { WindowGroup {
        HostedQuiniDerio(target: target).onOpenURL { link in
            guard link.scheme == "quiniderio", link.host == "open", let raw = URLComponents(url: link, resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == "url" })?.value, let url = URL(string: raw), JornadaStore.trusted(url) else { return }
            target = url
        }
    } }
}
struct HostedQuiniDerio: UIViewRepresentable {
    let target: URL
    func makeCoordinator() -> Coordinator { Coordinator() }
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.userContentController.add(context.coordinator, name: "quiniWidgets")
        let view = WKWebView(frame: .zero, configuration: config)
        view.navigationDelegate = context.coordinator
        view.allowsBackForwardNavigationGestures = true
        context.coordinator.lastTarget = target
        view.load(URLRequest(url: target))
        return view
    }
    func updateUIView(_ view: WKWebView, context: Context) {
        if context.coordinator.lastTarget != target { context.coordinator.lastTarget = target; view.load(URLRequest(url: target)) }
    }
    static func dismantleUIView(_ view: WKWebView, coordinator: Coordinator) { view.configuration.userContentController.removeScriptMessageHandler(forName: "quiniWidgets") }
    class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
        var lastTarget: URL?
        func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.frameInfo.isMainFrame, let url = message.frameInfo.request.url, JornadaStore.trusted(url), let body = message.body as? [String: String], let mode = body["mode"], ["compact", "full"].contains(mode) else { return }
            JornadaStore.defaults.set(mode, forKey: "preferred-kind")
            Task { let _ = await JornadaStore.fetch(); WidgetCenter.shared.reloadAllTimelines() }
        }
        func webView(_ view: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = action.request.url else { decisionHandler(.cancel); return }
            if JornadaStore.trusted(url) { decisionHandler(.allow) }
            else { decisionHandler(.cancel); if action.targetFrame?.isMainFrame != false, ["https", "mailto"].contains(url.scheme ?? "") { UIApplication.shared.open(url) } }
        }
    }
}
