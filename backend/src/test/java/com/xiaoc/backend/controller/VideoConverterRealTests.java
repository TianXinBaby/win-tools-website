package com.xiaoc.backend.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.xiaoc.backend.service.video.VideoProcessRunner;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import java.io.ByteArrayOutputStream;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;
import static org.assertj.core.api.Assertions.*;

/** Explicit opt-in: CI does not need FFmpeg. Uses an actual HTTP server, cookies and multipart. */
@EnabledIfEnvironmentVariable(named = "VIDEO_REAL_FFMPEG", matches = ".+")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class VideoConverterRealTests {
    @LocalServerPort int port;
    @Autowired ObjectMapper mapper;
    @Autowired VideoProcessRunner runner;
    @TempDir Path directory;
    @DynamicPropertySource static void config(DynamicPropertyRegistry props) {
        props.add("win-tools.video-converter.enabled", () -> true);
        props.add("win-tools.video-converter.ffmpeg-path", () -> System.getenv("VIDEO_REAL_FFMPEG"));
        props.add("win-tools.video-converter.ffprobe-path", () -> System.getenv("VIDEO_REAL_FFPROBE"));
        props.add("win-tools.video-converter.temp-dir", () -> "target/video-real-jobs");
        props.add("server.address", () -> "127.0.0.1");
    }
    HttpRequest.Builder request(String path) { return HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path)); }
    JsonNode json(HttpClient client, HttpRequest req) throws Exception {
        var response = client.send(req, HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).as(response.body()).isEqualTo(200);
        return mapper.readTree(response.body()).path("data");
    }
    @Test void asfThroughHttpToAllFiveContainersWithAndWithoutAudio() throws Exception {
        var client = HttpClient.newBuilder().cookieHandler(new CookieManager(null, CookiePolicy.ACCEPT_ALL)).build();
        var csrf = json(client, request("/api/admin/auth/csrf").GET().build());
        assertThat(json(client, request("/api/tools/video-converter/capabilities").GET().build()).path("available").asBoolean()).isTrue();
        for (boolean audio : List.of(true, false)) {
            Path source = directory.resolve(audio ? "中文 空格 &源.asf" : "silent.asf");
            var command = new ArrayList<>(List.of(System.getenv("VIDEO_REAL_FFMPEG"), "-y", "-v", "error", "-f", "lavfi", "-i", "color=c=blue:s=160x120:r=10"));
            if (audio) command.addAll(List.of("-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100"));
            command.addAll(List.of("-t", "1", "-c:v", "wmv2", "-c:a", "wmav2", "-f", "asf", source.toString()));
            runner.run(command, 30000, new AtomicBoolean(), line -> {});
            assertThat(probe(source).path("format").path("format_name").asText()).isEqualTo("asf");
            for (String format : List.of("mp4", "mkv", "mov", "avi", "webm")) {
                String boundary = "test-boundary-" + UUID.randomUUID();
                var body = new ByteArrayOutputStream();
                body.write(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"targetFormat\"\r\n\r\n" + format
                        + "\r\n--" + boundary + "\r\nContent-Disposition: form-data; name=\"file\"; filename=\"" + source.getFileName()
                        + "\"\r\nContent-Type: video/x-ms-asf\r\n\r\n").getBytes(StandardCharsets.UTF_8));
                body.write(Files.readAllBytes(source));
                body.write(("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
                JsonNode job = json(client, request("/api/tools/video-converter/jobs")
                        .header(csrf.path("headerName").asText(), csrf.path("token").asText())
                        .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                        .POST(HttpRequest.BodyPublishers.ofByteArray(body.toByteArray())).build());
                String url = "/api/tools/video-converter/jobs/" + job.path("jobId").asText();
                for (int i=0; i<300; i++) {
                    job = json(client, request(url).GET().build());
                    if (Set.of("COMPLETED", "FAILED").contains(job.path("status").asText())) break;
                    Thread.sleep(100);
                }
                assertThat(job.path("status").asText()).as(job.toString()).isEqualTo("COMPLETED");
                var download = client.send(request(url + "/download").GET().build(), HttpResponse.BodyHandlers.ofByteArray());
                assertThat(download.statusCode()).isEqualTo(200);
                Path output = Files.write(directory.resolve((audio ? "audio." : "silent.") + format), download.body());
                var metadata = probe(output);
                assertThat(metadata.path("format").path("format_name").asText()).contains(
                        format.equals("mp4") || format.equals("mov") ? "mov" : format.equals("mkv") ? "matroska" : format);
                var codecs = new ArrayList<String>();
                metadata.path("streams").forEach(stream -> codecs.add(stream.path("codec_name").asText()));
                assertThat(codecs).contains(format.equals("avi") ? "mpeg4" : format.equals("webm") ? "vp9" : "h264");
                assertThat(codecs).hasSize(audio ? 2 : 1);
                if (audio) assertThat(codecs).contains(format.equals("avi") ? "mp3" : format.equals("webm") ? "opus" : "aac");
                // Also exercise implicit HEAD headers and subsequent cancellation cleanup.
                var head = client.send(request(url + "/download").method("HEAD", HttpRequest.BodyPublishers.noBody()).build(),
                        HttpResponse.BodyHandlers.ofByteArray());
                assertThat(head.statusCode()).isEqualTo(200);
                assertThat(head.body()).isEmpty();
                assertThat(head.headers().firstValueAsLong("Content-Length")).hasValue(download.body().length);
                assertThat(HttpClient.newHttpClient().send(request(url + "/download").GET().build(), HttpResponse.BodyHandlers.discarding()).statusCode()).isEqualTo(404);
                json(client, request(url).header(csrf.path("headerName").asText(), csrf.path("token").asText()).DELETE().build());
                assertThat(Path.of("target/video-real-jobs/job-" + job.path("jobId").asText())).doesNotExist();
                System.out.println("REAL_VIDEO_PASS input=asf audio=" + audio + " target=" + format + " codecs=" + codecs + " bytes=" + download.body().length);
            }
        }
    }
    JsonNode probe(Path file) throws Exception {
        return mapper.readTree(runner.run(List.of(System.getenv("VIDEO_REAL_FFPROBE"), "-v", "error", "-show_entries",
                "format=format_name:stream=codec_name", "-of", "json", file.toString()), 10000, new AtomicBoolean(), line -> {}));
    }
}
