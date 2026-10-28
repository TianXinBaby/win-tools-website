package com.xiaoc.backend.service;

import com.xiaoc.backend.config.VideoConverterProperties;
import com.xiaoc.backend.exception.VideoConversionException;
import com.xiaoc.backend.service.video.VideoTranscoder;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;
import java.nio.file.*;
import java.nio.file.attribute.FileTime;
import java.nio.file.attribute.PosixFilePermissions;
import java.time.Instant;
import java.io.InputStream;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.IntConsumer;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class VideoConverterServiceTests {
    @TempDir Path directory;
    VideoConverterProperties config;
    VideoTranscoder transcoder;
    VideoConverterService service;
    @BeforeEach void setup() throws Exception {
        config = new VideoConverterProperties(); config.setEnabled(true); config.setTempDir(directory.toString());
        transcoder = mock(VideoTranscoder.class);
        when(transcoder.available()).thenReturn(true); when(transcoder.probe(any(), any())).thenReturn(1.0);
        doAnswer(call -> {
            Files.write(call.getArgument(1), new byte[]{1,2,3});
            ((IntConsumer) call.getArgument(5)).accept(50); return null;
        }).when(transcoder).convert(any(), any(), anyString(), anyDouble(), any(), any());
        service = new VideoConverterService(config, transcoder); service.initialize();
    }
    @AfterEach void close() { service.close(); }
    MockMultipartFile file() { return new MockMultipartFile("file", "../../中文 空格;&.ASF", "video/x-ms-asf", new byte[]{1}); }
    VideoConverterService.JobView await(String id, String status) throws Exception {
        for (int i=0; i<200; i++) {
            var job = service.status(id, "owner");
            if (job.status().equals(status)) return job;
            Thread.sleep(10);
        }
        throw new AssertionError("Did not reach " + status);
    }
    @Test void completionSafeDownloadAndOwnership() throws Exception {
        var created = service.submit(file(), "mp4", "owner");
        var job = await(created.jobId(), "COMPLETED");
        assertThat(job.progress()).isEqualTo(100);
        assertThat(job.downloadUrl()).endsWith(job.jobId() + "/download");
        var download = service.download(job.jobId(), "owner");
        try (var stream = download.resource().getInputStream()) { assertThat(stream.readAllBytes()).containsExactly(1,2,3); }
        assertThat(download.filename()).isEqualTo("converted.mp4");
        assertThat(directory.resolve("job-" + job.jobId()).resolve("input.bin")).doesNotExist();
        assertThatThrownBy(() -> service.status(job.jobId(), "other")).hasMessage("VIDEO_JOB_NOT_FOUND");
        assertThatThrownBy(() -> service.download(job.jobId(), "other")).hasMessage("VIDEO_JOB_NOT_FOUND");
        assertThatThrownBy(() -> service.cancel(job.jobId(), "other")).hasMessage("VIDEO_JOB_NOT_FOUND");
    }
    @Test void disabledAndUnavailable() {
        service.close(); config.setEnabled(false);
        service = new VideoConverterService(config, transcoder); service.initialize();
        assertThat(service.capabilities().reason()).isEqualTo("VIDEO_DISABLED");
        assertThatThrownBy(() -> service.submit(file(), "mp4", "owner")).hasMessage("VIDEO_DISABLED");
        service.close(); config.setEnabled(true); when(transcoder.available()).thenReturn(false);
        service = new VideoConverterService(config, transcoder); service.initialize();
        assertThat(service.capabilities().reason()).isEqualTo("VIDEO_DEPENDENCY_UNAVAILABLE");
    }
    @Test void rejectsBadRequests() {
        assertThatThrownBy(() -> service.submit(file(), "exe", "owner")).hasMessage("VIDEO_TARGET_UNSUPPORTED");
        assertThatThrownBy(() -> service.submit(new MockMultipartFile("file", "url.txt", "text/plain", new byte[]{1}), "mp4", "owner")).hasMessage("VIDEO_INPUT_UNSUPPORTED");
        assertThatThrownBy(() -> service.submit(new MockMultipartFile("file", "empty.asf", "video/asf", new byte[0]), "mp4", "owner")).hasMessage("VIDEO_INVALID_FILE");
        config.setMaxUploadBytes(1);
        assertThatThrownBy(() -> service.submit(new MockMultipartFile("file", "large.asf", "video/asf", new byte[2]), "mp4", "owner")).hasMessage("VIDEO_TOO_LARGE");
    }
    @Test void boundedQueueAndCancellation() throws Exception {
        CountDownLatch running = new CountDownLatch(1);
        doAnswer(call -> {
            running.countDown(); AtomicBoolean cancelled = call.getArgument(4);
            while (!cancelled.get()) Thread.sleep(10);
            throw new VideoConversionException(409, "VIDEO_CANCELLED");
        }).when(transcoder).convert(any(), any(), anyString(), anyDouble(), any(), any());
        var first = service.submit(file(), "mp4", "owner");
        assertThat(running.await(2, TimeUnit.SECONDS)).isTrue();
        var second = service.submit(file(), "avi", "owner"); service.submit(file(), "webm", "owner");
        assertThat(service.status(second.jobId(), "owner").status()).isEqualTo("QUEUED");
        assertThatThrownBy(() -> service.download(first.jobId(), "owner")).hasMessage("VIDEO_NOT_READY");
        assertThatThrownBy(() -> service.submit(file(), "mp4", "owner")).hasMessage("VIDEO_QUEUE_FULL");
        service.cancel(second.jobId(), "owner");
        assertThat(directory.resolve("job-" + second.jobId())).doesNotExist();
        service.submit(file(), "mp4", "owner"); service.cancel(first.jobId(), "owner");
        assertThat(service.status(first.jobId(), "owner").status()).isEqualTo("CANCELLED");
    }
    @Test void failureAndTimeout() throws Exception {
        when(transcoder.probe(any(), any())).thenThrow(new VideoConversionException(422, "VIDEO_NO_VIDEO_STREAM"));
        var first = service.submit(file(), "mp4", "owner");
        assertThat(await(first.jobId(), "FAILED").errorCode()).isEqualTo("VIDEO_NO_VIDEO_STREAM");
        doReturn(1.0).when(transcoder).probe(any(), any());
        doThrow(new VideoConversionException(422, "VIDEO_TIMEOUT")).when(transcoder).convert(any(), any(), anyString(), anyDouble(), any(), any());
        var second = service.submit(file(), "mp4", "owner");
        assertThat(await(second.jobId(), "FAILED").errorCode()).isEqualTo("VIDEO_TIMEOUT");
        assertThat(directory.resolve("job-" + second.jobId())).doesNotExist();
    }
    @Test void expirationAndStartupCleanupPreserveUnrelatedFiles() throws Exception {
        var first = service.submit(file(), "mp4", "owner"); await(first.jobId(), "COMPLETED");
        config.setJobTtlMinutes(-1); // Test logical expiry without waiting 30 minutes.
        service.cleanupExpired();
        assertThatThrownBy(() -> service.status(first.jobId(), "owner")).hasMessage("VIDEO_JOB_NOT_FOUND");
        assertThat(directory.resolve("job-" + first.jobId())).doesNotExist();
        config.setJobTtlMinutes(30);
        String id = UUID.randomUUID().toString();
        Path stale = Files.createDirectory(directory.resolve("job-" + id));
        Path marker = Files.writeString(stale.resolve(".win-tools-job"), id);
        Files.setLastModifiedTime(marker, FileTime.from(Instant.now().minusSeconds(3600)));
        Path unrelated = Files.writeString(directory.resolve("keep.txt"), "keep");
        Path unknown = Files.createDirectory(directory.resolve("job-" + UUID.randomUUID()));
        service.close(); service = new VideoConverterService(config, transcoder); service.initialize();
        assertThat(stale).doesNotExist(); assertThat(unrelated).exists(); assertThat(unknown).exists();
    }
    @Test void duplicateCancelCleansCompletedFile() throws Exception {
        var job = service.submit(file(), "mp4", "owner"); await(job.jobId(), "COMPLETED");
        service.cancel(job.jobId(), "owner"); service.cancel(job.jobId(), "owner");
        assertThat(service.status(job.jobId(), "owner").status()).isEqualTo("CANCELLED");
        assertThat(directory.resolve("job-" + job.jobId())).doesNotExist();
    }

    @Test void cancelCleansCompletedOutputBeforeWorkerReleasesCapacity() throws Exception {
        var job = service.submit(file(), "mp4", "owner");
        await(job.jobId(), "COMPLETED");
        // Reproduce the state after worker finalization, before its capacity release.
        var states = (java.util.Map<?, ?>) org.springframework.test.util.ReflectionTestUtils.getField(service, "jobs");
        Object state = states.get(job.jobId());
        var released = (AtomicBoolean) org.springframework.test.util.ReflectionTestUtils.getField(state, "released");
        for (int i = 0; i < 200 && !released.get(); i++) Thread.sleep(1);
        assertThat(released.get()).isTrue();
        released.set(false);
        service.cancel(job.jobId(), "owner");
        assertThat(directory.resolve("job-" + job.jobId())).doesNotExist();
        assertThat(service.status(job.jobId(), "owner").downloadUrl()).isNull();
    }

    @Test void privatePermissionsAreSetBeforeUploadOrConversionStarts() throws Exception {
        Assumptions.assumeTrue(Files.getFileStore(directory).supportsFileAttributeView("posix"));
        var upload = new MockMultipartFile("file", "video.asf", "video/asf", new byte[]{1}) {
            @Override public InputStream getInputStream() throws java.io.IOException {
                try (var paths = Files.list(directory)) {
                    Path job = paths.filter(Files::isDirectory).findFirst().orElseThrow();
                    assertThat(Files.getPosixFilePermissions(job)).isEqualTo(PosixFilePermissions.fromString("rwx------"));
                    for (String name : new String[]{".win-tools-job", "input.bin", "output.mp4"})
                        assertThat(Files.getPosixFilePermissions(job.resolve(name)))
                                .isEqualTo(PosixFilePermissions.fromString("rw-------"));
                }
                return super.getInputStream();
            }
        };
        doAnswer(call -> {
            Path output = call.getArgument(1);
            assertThat(Files.getPosixFilePermissions(output)).isEqualTo(PosixFilePermissions.fromString("rw-------"));
            Files.write(output, new byte[]{1,2,3});
            return null;
        }).when(transcoder).convert(any(), any(), anyString(), anyDouble(), any(), any());
        var job = service.submit(upload, "mp4", "owner");
        await(job.jobId(), "COMPLETED");
        assertThat(Files.getPosixFilePermissions(directory.resolve("job-" + job.jobId()).resolve("output.mp4")))
                .isEqualTo(PosixFilePermissions.fromString("rw-------"));
    }

    @Test void cancellationPreservesAlreadyOpenedDownloadAndCleansFiles() throws Exception {
        var job = service.submit(file(), "mp4", "owner");
        await(job.jobId(), "COMPLETED");
        var download = service.download(job.jobId(), "owner");
        Path jobDirectory = directory.resolve("job-" + job.jobId());
        try (var stream = download.resource().getInputStream()) {
            service.cancel(job.jobId(), "owner");
            service.cancel(job.jobId(), "owner");
            service.cleanupExpired();
            assertThat(jobDirectory).doesNotExist();
            assertThat(stream.readAllBytes()).containsExactly(1,2,3);
        }
        assertThat(jobDirectory).doesNotExist();
    }

    @ParameterizedTest
    @ValueSource(ints = {0, 3, 4})
    void downloadEnforcesStoredOutputSizeIncludingTheExactLimit(int size) throws Exception {
        var job = service.submit(file(), "mp4", "owner");
        await(job.jobId(), "COMPLETED");
        config.setMaxOutputBytes(3);
        Files.write(directory.resolve("job-" + job.jobId()).resolve("output.mp4"), new byte[size]);
        if (size == 3) {
            var download = service.download(job.jobId(), "owner");
            assertThat(download.size()).isEqualTo(3);
            try (var input = download.resource().getInputStream()) { assertThat(input.readAllBytes()).hasSize(3); }
        } else {
            assertThatThrownBy(() -> service.download(job.jobId(), "owner"))
                    .isInstanceOf(VideoConversionException.class).hasMessage("VIDEO_OUTPUT_INVALID");
        }
        service.cancel(job.jobId(), "owner");
        assertThat(directory.resolve("job-" + job.jobId())).doesNotExist();
    }

    @Test void cancellationKeepsFilesUntilConversionHasActuallyExited() throws Exception {
        CountDownLatch running = new CountDownLatch(1), allowExit = new CountDownLatch(1);
        doAnswer(call -> {
            running.countDown();
            assertThat(allowExit.await(3, TimeUnit.SECONDS)).isTrue();
            throw new VideoConversionException(409, "VIDEO_CANCELLED");
        }).when(transcoder).convert(any(), any(), anyString(), anyDouble(), any(), any());
        var job = service.submit(file(), "mp4", "owner");
        assertThat(running.await(2, TimeUnit.SECONDS)).isTrue();
        Path jobDirectory = directory.resolve("job-" + job.jobId());
        try {
            service.cancel(job.jobId(), "owner");
            assertThat(jobDirectory.resolve("input.bin")).exists();
        } finally { allowExit.countDown(); }
        for (int i = 0; i < 200 && Files.exists(jobDirectory); i++) Thread.sleep(10);
        assertThat(jobDirectory).doesNotExist();
        assertThat(service.status(job.jobId(), "owner").status()).isEqualTo("CANCELLED");
    }

    @Test void interruptedShutdownWaitsForConversionBeforeDeletingFiles() throws Exception {
        CountDownLatch running = new CountDownLatch(1), cancelled = new CountDownLatch(1), allowExit = new CountDownLatch(1);
        doAnswer(call -> {
            running.countDown();
            AtomicBoolean cancellation = call.getArgument(4);
            while (!cancellation.get()) {
                try { Thread.sleep(5); } catch (InterruptedException ignored) { }
            }
            cancelled.countDown();
            boolean interrupted = false;
            while (true) {
                try { allowExit.await(); break; } catch (InterruptedException ignored) { interrupted = true; }
            }
            if (interrupted) Thread.currentThread().interrupt();
            throw new VideoConversionException(409, "VIDEO_CANCELLED");
        }).when(transcoder).convert(any(), any(), anyString(), anyDouble(), any(), any());
        var job = service.submit(file(), "mp4", "owner");
        assertThat(running.await(2, TimeUnit.SECONDS)).isTrue();
        Thread shutdown = new Thread(service::close);
        shutdown.start();
        try {
            assertThat(cancelled.await(2, TimeUnit.SECONDS)).isTrue();
            shutdown.interrupt();
            shutdown.join(100);
            assertThat(shutdown.isAlive()).isTrue();
            assertThat(directory.resolve("job-" + job.jobId()).resolve("input.bin")).exists();
        } finally {
            allowExit.countDown();
            shutdown.join(3000);
        }
        assertThat(shutdown.isAlive()).isFalse();
        assertThat(shutdown.isInterrupted()).isTrue();
        assertThat(directory.resolve("job-" + job.jobId())).doesNotExist();
    }

    @Test void conversionCompletionCannotOverwriteCancellation() throws Exception {
        CountDownLatch running = new CountDownLatch(1), allowCompletion = new CountDownLatch(1);
        doAnswer(call -> {
            running.countDown();
            assertThat(allowCompletion.await(3, TimeUnit.SECONDS)).isTrue();
            Files.write(call.getArgument(1), new byte[]{1,2,3});
            ((IntConsumer) call.getArgument(5)).accept(99);
            return null;
        }).when(transcoder).convert(any(), any(), anyString(), anyDouble(), any(), any());
        var job = service.submit(file(), "mp4", "owner");
        assertThat(running.await(2, TimeUnit.SECONDS)).isTrue();
        try { service.cancel(job.jobId(), "owner"); }
        finally { allowCompletion.countDown(); }
        Path jobDirectory = directory.resolve("job-" + job.jobId());
        for (int i = 0; i < 200 && Files.exists(jobDirectory); i++) Thread.sleep(10);
        var cancelled = service.status(job.jobId(), "owner");
        assertThat(cancelled.status()).isEqualTo("CANCELLED");
        assertThat(cancelled.progress()).isNull();
        assertThat(cancelled.downloadUrl()).isNull();
        assertThat(jobDirectory).doesNotExist();
    }

    @Test void failedCleanupRetainsMarkerForRetry() throws Exception {
        var job = service.submit(file(), "mp4", "owner");
        await(job.jobId(), "COMPLETED");
        Path jobDirectory = directory.resolve("job-" + job.jobId());
        Path output = jobDirectory.resolve("output.mp4");
        // Windows read-only files reproduce a real cleanup failure without changing JVM mocking.
        Assumptions.assumeTrue(System.getProperty("os.name").startsWith("Windows"));
        Files.setAttribute(output, "dos:readonly", true);
        try {
            service.cancel(job.jobId(), "owner");
            assertThat(jobDirectory.resolve(".win-tools-job")).exists();
            assertThat(output).exists();
        } finally { Files.setAttribute(output, "dos:readonly", false); }
        config.setJobTtlMinutes(-1);
        service.cleanupExpired();
        assertThat(jobDirectory).doesNotExist();
    }

    @Test void uploadStreamCannotBypassServerSizeLimit() {
        config.setMaxUploadBytes(1);
        var upload = new MockMultipartFile("file", "video.asf", "video/asf", new byte[]{1,2}) {
            @Override public long getSize() { return 1; }
        };
        assertThatThrownBy(() -> service.submit(upload, "mp4", "owner")).hasMessage("VIDEO_TOO_LARGE");
        assertThat(directory.toFile().list()).isEmpty();
        verify(transcoder, never()).probe(any(), any());
    }

    @Test void failedUploadWithIncompleteMarkerRemainsTrackedUntilCleanupSucceeds() throws Exception {
        Assumptions.assumeTrue(System.getProperty("os.name").startsWith("Windows"));
        config.setMaxRetainedJobs(1);
        AtomicReference<Path> failedDirectory = new AtomicReference<>();
        var upload = new MockMultipartFile("file", "video.asf", "video/asf", new byte[]{1}) {
            @Override public InputStream getInputStream() throws java.io.IOException {
                try (var paths = Files.list(directory)) {
                    Path job = paths.filter(Files::isDirectory).findFirst().orElseThrow();
                    failedDirectory.set(job);
                    // Simulate a partial marker write plus an input held against deletion.
                    Files.writeString(job.resolve(".win-tools-job"), "");
                    Files.setAttribute(job.resolve("input.bin"), "dos:readonly", true);
                }
                throw new java.io.IOException("upload failed");
            }
        };
        try {
            assertThatThrownBy(() -> service.submit(upload, "mp4", "owner")).hasMessage("VIDEO_STORAGE_UNAVAILABLE");
            assertThatThrownBy(() -> service.submit(file(), "mp4", "owner")).hasMessage("VIDEO_QUEUE_FULL");
        } finally { Files.setAttribute(failedDirectory.get().resolve("input.bin"), "dos:readonly", false); }
        config.setJobTtlMinutes(-1);
        service.cleanupExpired();
        assertThat(failedDirectory.get()).doesNotExist();
    }
}
