package com.quiniderio.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

public class JornadaWidget extends AppWidgetProvider {
    private static final String MOVE = "com.quiniderio.app.MOVE", REFRESH = "com.quiniderio.app.REFRESH";
    static int[] ids(Context c, Class<?> type) { return AppWidgetManager.getInstance(c).getAppWidgetIds(new ComponentName(c, type)); }
    @Override public void onUpdate(Context c, AppWidgetManager manager, int[] ids) { renderAll(c); WidgetJob.schedule(c); WidgetJob.refresh(c); }
    @Override public void onEnabled(Context c) { WidgetJob.schedule(c); }
    @Override public void onAppWidgetOptionsChanged(Context c, AppWidgetManager manager, int id, Bundle options) { render(c, id, getClass() == CompactWidget.class); }
    @Override public void onDeleted(Context c, int[] ids) { for (int id : ids) WidgetStore.prefs(c).edit().remove("selected:"+id).remove("page:"+id).apply(); }
    @Override public void onDisabled(Context c) { if (ids(c, CompactWidget.class).length + ids(c, FullRoundWidget.class).length == 0) WidgetJob.cancel(c); }
    @Override public void onReceive(Context c, Intent intent) {
        super.onReceive(c, intent);
        if (REFRESH.equals(intent.getAction())) WidgetJob.refresh(c);
        if (MOVE.equals(intent.getAction())) {
            int id = intent.getIntExtra("id", -1), direction = intent.getIntExtra("direction", 1);
            JSONObject s = WidgetStore.cached(c); if (s == null) return;
            JSONArray matches = s.optJSONArray("matches"); if (matches == null || matches.length() == 0) return;
            boolean compact = getClass() == CompactWidget.class;
            if (compact) {
                int index = selected(c, id, matches);
                int next = Math.floorMod(index + direction, matches.length());
                WidgetStore.prefs(c).edit().putString("selected:"+id, matches.optJSONObject(next).optString("id")).apply();
            } else {
                int count = pageSize(c, id), pages = (matches.length()+count-1)/count;
                int next = Math.floorMod(WidgetStore.prefs(c).getInt("page:"+id, 0)+direction, pages);
                WidgetStore.prefs(c).edit().putInt("page:"+id, next).apply();
            }
            render(c, id, compact);
        }
    }
    static void renderAll(Context c) {
        for (int id : ids(c, CompactWidget.class)) render(c, id, true);
        for (int id : ids(c, FullRoundWidget.class)) render(c, id, false);
    }
    private static int selected(Context c, int id, JSONArray matches) {
        String selected = WidgetStore.prefs(c).getString("selected:"+id, "");
        for (int i=0; i<matches.length(); i++) if (selected.equals(matches.optJSONObject(i).optString("id"))) return i;
        return 0;
    }
    private static int pageSize(Context c, int id) {
        int height = AppWidgetManager.getInstance(c).getAppWidgetOptions(id).getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 250);
        return height >= 490 ? 7 : height >= 380 ? 5 : 3;
    }
    private static PendingIntent open(Context c, int id, String url) {
        if (!MainActivity.trusted(Uri.parse(url))) url="https://quiniderio.vercel.app/";
        Intent i = new Intent(c, MainActivity.class).putExtra("url",url).setData(Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(c,id,i,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    }
    private static PendingIntent action(Context c, int id, boolean compact, String action, int direction) {
        Intent i=new Intent(c,compact?CompactWidget.class:FullRoundWidget.class).setAction(action).setData(Uri.parse("quiniderio://widget/"+id+"/"+action+"/"+direction)).putExtra("id",id).putExtra("direction",direction);
        return PendingIntent.getBroadcast(c,id,i,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    }
    private static void render(Context c, int id, boolean compact) {
        RemoteViews view = new RemoteViews(c.getPackageName(), R.layout.widget);
        JSONObject s = WidgetStore.cached(c);
        JSONArray matches = s==null?new JSONArray():s.optJSONArray("matches"); if(matches==null)matches=new JSONArray();
        view.setTextViewText(R.id.header,"QuiniDerio"+(s==null?"":" · J"+s.optInt("round")));
        view.setOnClickPendingIntent(R.id.header,open(c,id,"https://quiniderio.vercel.app/"));
        view.removeAllViews(R.id.matches);
        int count=compact?1:pageSize(c,id),pages=Math.max(1,(matches.length()+count-1)/count);
        int page=Math.floorMod(WidgetStore.prefs(c).getInt("page:"+id,0),pages);
        int start=compact?selected(c,id,matches):page*count;
        for(int i=start; i<Math.min(start+count,matches.length()); i++) {
            JSONObject m=matches.optJSONObject(i); RemoteViews row=new RemoteViews(c.getPackageName(),compact?R.layout.widget_compact_row:R.layout.widget_row);
            row.setTextViewText(R.id.home,m.optString("home"));row.setTextViewText(R.id.away,m.optString("away"));
            String status=m.optString("status"),score=!m.isNull("homeScore")&&!m.isNull("awayScore")?m.optInt("homeScore")+" – "+m.optInt("awayScore"):"scheduled".equals(status)?m.optString("time","—"):"—";
            row.setTextViewText(R.id.score,score);row.setTextViewText(R.id.state,m.optString("statusLabel"));row.setTextViewText(R.id.date,m.optString("date"));
            row.setTextColor(R.id.state,c.getColor("live".equals(status)||"halftime".equals(status)?R.color.widget_live:R.color.widget_muted));
            for(String side:new String[]{"home","away"}) {
                int image="home".equals(side)?R.id.home_crest:R.id.away_crest;
                Bitmap bitmap=WidgetStore.icon(c,m.optString(side+"Crest",""));
                if(bitmap!=null)row.setImageViewBitmap(image,bitmap);else row.setViewVisibility(image,View.GONE);
            }
            row.setOnClickPendingIntent(R.id.match_row,open(c,id,m.optString("url")));
            row.setContentDescription(R.id.match_row,m.optString("home")+", "+score+", "+m.optString("away")+", "+m.optString("statusLabel"));
            view.addView(R.id.matches,row);
        }
        String when="";
        if(s!=null)try{when=DateTimeFormatter.ofPattern("dd/MM HH:mm").withZone(ZoneId.of("Europe/Madrid")).format(Instant.parse(s.getString("fetchedAt")));}catch(Exception ignored){}
        view.setTextViewText(R.id.updated,(WidgetStore.prefs(c).getBoolean("offline",false)?"Sin conexión · ":"")+(s==null?"Pulsa ↻ para consultar":"Consultado "+when));
        view.setTextViewText(R.id.page,matches.length()==0?"Sin datos":compact?(start+1)+" de "+matches.length():(start+1)+"–"+Math.min(start+count,matches.length())+" de "+matches.length());
        view.setOnClickPendingIntent(R.id.previous,action(c,id,compact,MOVE,-1));view.setOnClickPendingIntent(R.id.next,action(c,id,compact,MOVE,1));view.setOnClickPendingIntent(R.id.refresh,action(c,id,compact,REFRESH,0));
        AppWidgetManager.getInstance(c).updateAppWidget(id,view);
    }
}
