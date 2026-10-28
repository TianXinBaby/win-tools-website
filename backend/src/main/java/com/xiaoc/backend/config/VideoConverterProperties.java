package com.xiaoc.backend.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties("win-tools.video-converter")
public class VideoConverterProperties {
    private boolean enabled = false;
    private String ffmpegPath = "ffmpeg";
    private String ffprobePath = "ffprobe";
    private String tempDir = System.getProperty("java.io.tmpdir") + "/win-tools-video";
    private long maxUploadBytes = 500L * 1024 * 1024;
    private long maxOutputBytes = 500L * 1024 * 1024;
    private long maxDurationSeconds = 1800;
    private long timeoutSeconds = 900;
    private int maxConcurrentJobs = 1;
    private int queueCapacity = 2;
    private long jobTtlMinutes = 30;
    private int maxRetainedJobs = 12;
}
