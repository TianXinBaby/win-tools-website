package com.xiaoc.backend.service.video;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.xiaoc.backend.config.VideoConverterProperties;
import com.xiaoc.backend.exception.VideoConversionException;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.nio.file.Path;
import java.nio.file.Files;
import java.nio.file.attribute.BasicFileAttributes;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class VideoTranscoderTests {
    @TempDir Path directory;
    VideoProcessRunner runner;
    VideoTranscoder transcoder;
    @BeforeEach void setup() {
        runner = mock(VideoProcessRunner.class);
        transcoder = new VideoTranscoder(new VideoConverterProperties(), runner, new ObjectMapper());
    }
    void result(String json) { when(runner.run(anyList(), anyLong(), any(), any())).thenReturn(json); }
    String metadata(String format, String type, String duration) {
        return "{\"streams\":[{\"codec_type\":\"" + type + "\",\"width\":320,\"height\":240}],"
                + "\"format\":{\"format_name\":\"" + format + "\",\"duration\":\"" + duration + "\"}}";
    }
    @Test void verifiesActualAsfContainer() {
        result(metadata("asf", "video", "5.25"));
        assertThat(transcoder.probe(directory.resolve("input.bin"), new AtomicBoolean())).isEqualTo(5.25);
    }
    @Test void rejectsAudioOnlyAndUnsupportedContainer() {
        result(metadata("asf", "audio", "5"));
        assertThatThrownBy(() -> transcoder.probe(directory, new AtomicBoolean())).hasMessage("VIDEO_NO_VIDEO_STREAM");
        result(metadata("hls", "video", "5"));
        assertThatThrownBy(() -> transcoder.probe(directory, new AtomicBoolean())).hasMessage("VIDEO_INPUT_UNSUPPORTED");
    }
    @ParameterizedTest @ValueSource(strings = {"0", "-1", "1801", "NaN", "N/A"})
    void rejectsInvalidDuration(String duration) {
        result(metadata("asf", "video", duration));
        assertThatThrownBy(() -> transcoder.probe(directory, new AtomicBoolean())).hasMessage("VIDEO_DURATION_INVALID");
    }
    @ParameterizedTest @ValueSource(strings = {"broken", "{}", "{\"streams\":[]}"})
    void rejectsBrokenMetadata(String json) {
        result(json);
        assertThatThrownBy(() -> transcoder.probe(directory, new AtomicBoolean())).isInstanceOf(VideoConversionException.class);
    }
    @ParameterizedTest @ValueSource(strings = {"mp4", "mkv", "mov", "avi", "webm"})
    void compatibleEncodersAndSafeArguments(String format) {
        var args = transcoder.command(directory.resolve("中文 空格;&.asf"), directory.resolve("output." + format), format);
        assertThat(args).contains(directory.resolve("中文 空格;&.asf").toString(), "-nostdin", "pipe:1", "file,pipe", "0:v:0", "0:a:0?", "-fs", "-xerror");
        assertThat(args).containsSubsequence("-f", format.equals("mkv") ? "matroska" : format);
        assertThat(args).contains(format.equals("avi") ? "mpeg4" : format.equals("webm") ? "libvpx-vp9" : "libx264");
        assertThat(args).contains(format.equals("avi") ? "libmp3lame" : format.equals("webm") ? "libopus" : "aac");
        assertThat(args).doesNotContain("cmd", "sh", "-c");
    }
    @Test void rejectsArbitraryTargetAndMissingDependency() {
        assertThatThrownBy(() -> transcoder.command(directory, directory, "mp4;whoami")).hasMessage("VIDEO_TARGET_UNSUPPORTED");
        when(runner.run(anyList(), anyLong(), any(), any())).thenThrow(new VideoConversionException(503, "VIDEO_DEPENDENCY_UNAVAILABLE"));
        assertThat(transcoder.available()).isFalse();
    }
    @Test void readsActualProgressAndRejectsMissingOutput() {
        when(runner.run(anyList(), anyLong(), any(), any())).thenAnswer(call -> {
            Consumer<String> onLine = call.getArgument(3);
            onLine.accept("out_time_us=2500000"); onLine.accept("out_time_us=N/A"); return "";
        });
        var progress = new ArrayList<Integer>();
        assertThatThrownBy(() -> transcoder.convert(directory.resolve("input"), directory.resolve("output.mp4"),
                "mp4", 5, new AtomicBoolean(), progress::add)).hasMessage("VIDEO_OUTPUT_INVALID");
        assertThat(progress).containsExactly(50);
    }
    @Test
    @EnabledIfEnvironmentVariable(named = "VIDEO_REAL_FFMPEG", matches = ".+")
    void realFfmpegTruncatesExistingOutputAndPreservesPermissions() throws Exception {
        VideoConverterProperties config = new VideoConverterProperties();
        config.setFfmpegPath(System.getenv("VIDEO_REAL_FFMPEG"));
        config.setFfprobePath(System.getenv("VIDEO_REAL_FFPROBE"));
        VideoProcessRunner actual = new VideoProcessRunner();
        try {
            Path input = directory.resolve("source.asf");
            actual.run(List.of(config.getFfmpegPath(), "-y", "-v", "error", "-f", "lavfi", "-i",
                    "color=c=blue:s=160x120:r=10", "-t", "1", "-c:v", "wmv2", "-f", "asf",
                    input.toString()), 30000, new AtomicBoolean(), line -> {});
            Path output = directory.resolve("output.mp4");
            boolean posix = Files.getFileStore(directory).supportsFileAttributeView("posix");
            if (posix) Files.createFile(output, PosixFilePermissions.asFileAttribute(
                    PosixFilePermissions.fromString("rw-------")));
            else Files.createFile(output);
            Object identity = Files.readAttributes(output, BasicFileAttributes.class).fileKey();
            VideoTranscoder real = new VideoTranscoder(config, actual, new ObjectMapper());
            real.convert(input, output, "mp4", real.probe(input, new AtomicBoolean()),
                    new AtomicBoolean(), progress -> {});
            assertThat(Files.size(output)).isPositive();
            if (identity != null)
                assertThat(Files.readAttributes(output, BasicFileAttributes.class).fileKey()).isEqualTo(identity);
            if (posix) assertThat(Files.getPosixFilePermissions(output))
                    .isEqualTo(PosixFilePermissions.fromString("rw-------"));
        } finally { actual.close(); }
    }
}
