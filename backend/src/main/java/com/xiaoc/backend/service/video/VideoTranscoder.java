package com.xiaoc.backend.service.video;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.xiaoc.backend.config.VideoConverterProperties;
import com.xiaoc.backend.exception.VideoConversionException;
import org.springframework.stereotype.Component;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.IntConsumer;

@Component
public class VideoTranscoder {
    public static final List<String> INPUTS = List.of("asf", "wmv", "mp4", "mkv", "mov", "avi", "webm");
    public static final List<String> OUTPUTS = List.of("mp4", "mkv", "mov", "avi", "webm");
    private final VideoConverterProperties config;
    private final VideoProcessRunner runner;
    private final ObjectMapper mapper;
    public VideoTranscoder(VideoConverterProperties config, VideoProcessRunner runner, ObjectMapper mapper) {
        this.config = config;
        this.runner = runner;
        this.mapper = mapper;
    }
    public boolean available() {
        try {
            runner.run(List.of(config.getFfmpegPath(), "-version"), 5000, new AtomicBoolean(), line -> {});
            runner.run(List.of(config.getFfprobePath(), "-version"), 5000, new AtomicBoolean(), line -> {});
            return true;
        } catch (VideoConversionException e) { return false; }
    }

    public double probe(Path input, AtomicBoolean cancelled) {
        String json = runner.run(List.of(config.getFfprobePath(), "-v", "error",
                "-protocol_whitelist", "file,pipe", "-format_whitelist", "asf,mov,matroska,webm,avi",
                "-show_entries", "stream=codec_type,width,height:format=duration,format_name",
                "-of", "json", input.toString()), Math.min(15000, config.getTimeoutSeconds() * 1000),
                cancelled, line -> {});
        try {
            JsonNode metadata = mapper.readTree(json);
            boolean video = false;
            for (JsonNode stream : metadata.path("streams")) {
                if ("video".equals(stream.path("codec_type").asText())) {
                    video = true;
                    if (stream.path("width").asInt() <= 0 || stream.path("height").asInt() <= 0
                            || stream.path("width").asLong() * stream.path("height").asLong() > 3840L * 2160)
                        throw new VideoConversionException(422, "VIDEO_DIMENSIONS_UNSUPPORTED");
                }
            }
            if (!video) throw new VideoConversionException(422, "VIDEO_NO_VIDEO_STREAM");
            String format = metadata.path("format").path("format_name").asText();
            if (List.of(format.split(",")).stream().noneMatch(
                    List.of("asf", "mov", "matroska", "webm", "avi")::contains))
                throw new VideoConversionException(422, "VIDEO_INPUT_UNSUPPORTED");
            double duration = metadata.path("format").path("duration").asDouble(0);
            if (!Double.isFinite(duration) || duration <= 0 || duration > config.getMaxDurationSeconds())
                throw new VideoConversionException(422, "VIDEO_DURATION_INVALID");
            return duration;
        } catch (VideoConversionException e) { throw e; }
        catch (Exception e) { throw new VideoConversionException(422, "VIDEO_INVALID_FILE"); }
    }

    public void convert(Path input, Path output, String format, double duration,
                        AtomicBoolean cancelled, IntConsumer progress) {
        List<String> command = command(input, output, format);
        runner.run(command, config.getTimeoutSeconds() * 1000, cancelled, line -> {
            if (line.startsWith("out_time_us=")) {
                try {
                    progress.accept((int) Math.max(0, Math.min(99,
                            Long.parseLong(line.substring(12)) / (duration * 10000))));
                } catch (NumberFormatException ignored) { /* Unknown timestamps are not progress. */ }
            }
        });
        try {
            if (!Files.isRegularFile(output) || Files.size(output) == 0
                    || Files.size(output) >= config.getMaxOutputBytes())
                throw new VideoConversionException(422, "VIDEO_OUTPUT_INVALID");
            double actualDuration = probe(output, cancelled);
            if (actualDuration + 1 < duration * 0.98)
                throw new VideoConversionException(422, "VIDEO_OUTPUT_INVALID");
        } catch (java.io.IOException e) { throw new VideoConversionException(422, "VIDEO_OUTPUT_INVALID"); }
    }

    List<String> command(Path input, Path output, String format) {
        if (!OUTPUTS.contains(format)) throw new VideoConversionException(400, "VIDEO_TARGET_UNSUPPORTED");
        List<String> args = new ArrayList<>(List.of(config.getFfmpegPath(), "-hide_banner", "-nostdin",
                "-y", "-v", "error", "-xerror", "-filter_threads", "1", "-threads", "1",
                "-protocol_whitelist", "file,pipe", "-format_whitelist", "asf,mov,matroska,webm,avi",
                "-i", input.toString(), "-map", "0:v:0", "-map", "0:a:0?", "-sn", "-dn",
                "-map_metadata", "-1", "-map_chapters", "-1", "-threads", "1",
                "-vf", "pad=ceil(iw/2)*2:ceil(ih/2)*2", "-pix_fmt", "yuv420p"));
        switch (format) {
            case "avi" -> args.addAll(List.of("-c:v", "mpeg4", "-q:v", "5", "-c:a", "libmp3lame"));
            case "webm" -> args.addAll(List.of("-c:v", "libvpx-vp9", "-crf", "32", "-b:v", "0",
                    "-deadline", "realtime", "-cpu-used", "4", "-c:a", "libopus"));
            default -> args.addAll(List.of("-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-c:a", "aac"));
        }
        if (format.equals("mp4") || format.equals("mov")) args.addAll(List.of("-movflags", "+faststart"));
        args.addAll(List.of("-t", String.valueOf(config.getMaxDurationSeconds()), "-fs",
                String.valueOf(config.getMaxOutputBytes()), "-progress", "pipe:1", "-nostats",
                "-f", format.equals("mkv") ? "matroska" : format, output.toString()));
        return args;
    }
}
