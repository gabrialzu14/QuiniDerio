package com.quiniderio.app;

import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class WidgetJob extends JobService {
    private static final int PERIODIC=7101, MANUAL=7102;
    private static final ExecutorService QUEUE=Executors.newSingleThreadExecutor();
    private volatile boolean stopped=false;
    static void schedule(Context c) {
        JobScheduler scheduler=c.getSystemService(JobScheduler.class);
        if(scheduler.getPendingJob(PERIODIC)==null)scheduler.schedule(new JobInfo.Builder(PERIODIC,new ComponentName(c,WidgetJob.class)).setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setPeriodic(15*60*1000L).setPersisted(true).build());
    }
    static void refresh(Context c) {
        c.getSystemService(JobScheduler.class).schedule(new JobInfo.Builder(MANUAL,new ComponentName(c,WidgetJob.class)).setOverrideDeadline(0).build());
    }
    static void cancel(Context c) { JobScheduler s=c.getSystemService(JobScheduler.class);s.cancel(PERIODIC);s.cancel(MANUAL); }
    @Override public boolean onStartJob(JobParameters params) {
        stopped=false;
        QUEUE.execute(()->{
            boolean ok=WidgetStore.fetch(this);
            if(!stopped){JornadaWidget.renderAll(this);if(ok)WidgetStore.fetchIcons(this);JornadaWidget.renderAll(this);jobFinished(params,false);}
        });
        return true;
    }
    @Override public boolean onStopJob(JobParameters params) { stopped=true;return false; }
}
