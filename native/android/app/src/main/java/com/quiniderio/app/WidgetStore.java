package com.quiniderio.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

final class WidgetStore {
    private static byte[] readLimited(java.io.InputStream input, int limit) throws java.io.IOException {
        java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
        byte[] buffer = new byte[8192]; int count;
        while (out.size() < limit && (count = input.read(buffer, 0, Math.min(buffer.length, limit - out.size()))) != -1) out.write(buffer, 0, count);
        return out.toByteArray();
    }
    static SharedPreferences prefs(Context c) { return c.getSharedPreferences("widgets-v1", Context.MODE_PRIVATE); }
    static JSONObject cached(Context c) {
        try { JSONObject s = new JSONObject(prefs(c).getString("snapshot", "")); return s.getInt("version") == 1 ? s : null; }
        catch (Exception ignored) { return null; }
    }
    static HttpURLConnection connection(String url) throws Exception {
        if (!MainActivity.trusted(android.net.Uri.parse(url))) throw new IllegalArgumentException("Untrusted URL");
        HttpURLConnection request = (HttpURLConnection) new URL(url).openConnection();
        request.setConnectTimeout(5000); request.setReadTimeout(5000); request.setInstanceFollowRedirects(false);
        return request;
    }
    static boolean fetch(Context c) {
        HttpURLConnection request = null;
        try {
            request = connection("https://quiniderio.vercel.app/api/widgets");
            if (request.getResponseCode() != 200) throw new Exception("HTTP");
            byte[] bytes = readLimited(request.getInputStream(), 256 * 1024 + 1);
            if (bytes.length > 256 * 1024) throw new Exception("Response too large");
            String raw = new String(bytes, StandardCharsets.UTF_8);
            JSONObject data = new JSONObject(raw); JSONArray matches = data.getJSONArray("matches");
            if (data.getInt("version") != 1 || data.getInt("round") < 1 || matches.length() > 7 || matches.length() == 0) throw new Exception("Snapshot");
            JSONObject old = cached(c);
            SharedPreferences.Editor editor = prefs(c).edit();
            if (old != null && old.optInt("round") != data.getInt("round")) {
                for (String key : prefs(c).getAll().keySet()) if (key.startsWith("selected:") || key.startsWith("page:")) editor.remove(key);
            }
            editor.putString("snapshot", raw).putBoolean("offline", false).apply();
            return true;
        } catch (Exception ignored) { prefs(c).edit().putBoolean("offline", true).apply(); return false; }
        finally { if (request != null) request.disconnect(); }
    }
    private static File iconFile(Context c, String url) throws Exception {
        StringBuilder hash = new StringBuilder();
        for (byte b : MessageDigest.getInstance("SHA-256").digest(url.getBytes(StandardCharsets.UTF_8))) hash.append(String.format("%02x", b & 255));
        return new File(c.getCacheDir(), "crest-" + hash + ".png");
    }
    static Bitmap icon(Context c, String url) {
        try { return BitmapFactory.decodeFile(iconFile(c, url).toString()); } catch (Exception ignored) { return null; }
    }
    static void fetchIcons(Context c) {
        JSONObject s = cached(c); if (s == null) return;
        java.util.HashSet<String> urls = new java.util.HashSet<>();
        JSONArray matches = s.optJSONArray("matches"); if (matches == null) return;
        for (int i = 0; i < matches.length(); i++) for (String field : new String[]{"homeCrest", "awayCrest"}) {
            String url = matches.optJSONObject(i).optString(field, "");
            if (url.startsWith("https://quiniderio.vercel.app/api/widgets/crest?")) urls.add(url);
        }
        for (String url : urls) {
            HttpURLConnection request = null;
            try {
                File file = iconFile(c, url);
                if (file.exists() && System.currentTimeMillis() - file.lastModified() < 86400000) continue;
                request = connection(url);
                if (request.getResponseCode() != 200) continue;
                byte[] bytes = readLimited(request.getInputStream(), 64 * 1024 + 1);
                if (bytes.length > 64 * 1024 || BitmapFactory.decodeByteArray(bytes, 0, bytes.length) == null) continue;
                try (FileOutputStream out = new FileOutputStream(file)) { out.write(bytes); }
            } catch (Exception ignored) {} finally { if (request != null) request.disconnect(); }
        }
    }
}
