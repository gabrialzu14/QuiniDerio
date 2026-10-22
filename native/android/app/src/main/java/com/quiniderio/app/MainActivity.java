package com.quiniderio.app;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

/** Hosted app with a narrowly scoped bridge. Login stays in the app's own web session. */
public final class MainActivity extends Activity {
    private WebView web;
    static boolean trusted(Uri uri) { return uri != null && "https".equals(uri.getScheme()) && "quiniderio.vercel.app".equals(uri.getHost()) && (uri.getPort() == -1 || uri.getPort() == 443); }
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(false);
        web.addJavascriptInterface(new Bridge(), "QuiniWidgets");
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if (trusted(url)) return false;
                if (request.isForMainFrame() && ("https".equals(url.getScheme()) || "mailto".equals(url.getScheme()))) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, url)); } catch (Exception ignored) {}
                }
                return true;
            }
        });
        // Native edge-to-edge insets prevent the hosted UI from overlapping system bars.
        web.setOnApplyWindowInsetsListener((view, insets) -> {
            view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets;
        });
        setContentView(web);
        if (state == null) openIntent(getIntent()); else web.restoreState(state);
    }
    private void openIntent(Intent intent) {
        String raw = intent.getStringExtra("url");
        Uri uri = raw == null ? null : Uri.parse(raw);
        web.loadUrl(trusted(uri) ? uri.toString() : "https://quiniderio.vercel.app/");
    }
    @Override protected void onNewIntent(Intent intent) { super.onNewIntent(intent); setIntent(intent); openIntent(intent); }
    @Override protected void onSaveInstanceState(Bundle state) { web.saveState(state); super.onSaveInstanceState(state); }
    @Override public void onBackPressed() { if (web.canGoBack()) web.goBack(); else super.onBackPressed(); }
    @Override protected void onDestroy() { web.removeJavascriptInterface("QuiniWidgets"); web.destroy(); super.onDestroy(); }
    final class Bridge {
        @JavascriptInterface public boolean supportsWidgets() { return true; }
        @JavascriptInterface public void addWidget(String mode) {
            if (!"compact".equals(mode) && !"full".equals(mode)) return;
            runOnUiThread(() -> {
                if (!trusted(Uri.parse(web.getUrl() == null ? "" : web.getUrl()))) return;
                Class<?> provider = "compact".equals(mode) ? CompactWidget.class : FullRoundWidget.class;
                boolean requested = AppWidgetManager.getInstance(MainActivity.this).requestPinAppWidget(new ComponentName(MainActivity.this, provider), null, null);
                if (!requested) Toast.makeText(MainActivity.this, "Mantén pulsada la pantalla de inicio y busca QuiniDerio en Widgets.", Toast.LENGTH_LONG).show();
            });
        }
    }
}
