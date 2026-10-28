package com.xiaoc.backend.service;

import com.xiaoc.backend.config.VideoConverterProperties;
import com.xiaoc.backend.exception.VideoConversionException;
import com.xiaoc.backend.service.video.VideoTranscoder;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.InputStreamResource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.*;
import java.nio.file.attribute.FileAttribute;
import java.nio.file.attribute.PosixFilePermissions;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

@Slf4j
@Service
public class VideoConverterService {
    public record Capabilities(boolean enabled, boolean available, String reason, List<String> inputFormats,
                               List<String> outputFormats, long maxUploadBytes, long maxDurationSeconds,
                               long jobTtlMinutes) {}
    public record JobView(String jobId, String status, Integer progress, String targetFormat,
                          String errorCode, String downloadUrl) {}
    public record Download(InputStreamResource resource, long size, String filename) {}
    private static final String PREFIX = "job-";
    private final VideoConverterProperties config;
    private final VideoTranscoder transcoder;
    private final Map<String, Job> jobs = new ConcurrentHashMap<>();
    private ThreadPoolExecutor executor;
    private ScheduledExecutorService reaper;
    private Semaphore slots;
    private Path root;
    private volatile boolean ready;
    private volatile boolean closing;
    private volatile long lastDependencyCheck;
    private volatile boolean dependencyAvailable;

    public VideoConverterService(VideoConverterProperties config, VideoTranscoder transcoder) {
        this.config = config;
        this.transcoder = transcoder;
    }

    @PostConstruct
    public void initialize() {
        if (!config.isEnabled()) return;
        try {
            if (config.getMaxConcurrentJobs() < 1 || config.getQueueCapacity() < 0
                    || config.getJobTtlMinutes() < 1 || config.getTimeoutSeconds() < 1
                    || config.getMaxUploadBytes() < 1 || config.getMaxOutputBytes() < 1
                    || config.getMaxRetainedJobs() < 1 || config.getMaxDurationSeconds() < 1)
                throw new IllegalArgumentException();
            root = Path.of(config.getTempDir()).toAbsolutePath().normalize();
            Files.createDirectories(root, permissions(root, "rwx------"));
            if (Files.isSymbolicLink(root)) throw new IOException();
            restrict(root, "rwx------");
            int count = config.getMaxConcurrentJobs();
            slots = new Semaphore(count + config.getQueueCapacity());
            executor = new ThreadPoolExecutor(count, count, 0, TimeUnit.SECONDS,
                    new LinkedBlockingQueue<>(Math.max(1, config.getQueueCapacity())),
                    runnable -> daemon(runnable, "video-worker"), new ThreadPoolExecutor.AbortPolicy());
            reaper = Executors.newSingleThreadScheduledExecutor(r -> daemon(r, "video-cleanup"));
            ready = true;
            cleanupExpired();
            reaper.scheduleWithFixedDelay(this::cleanupExpired, 30, 30, TimeUnit.SECONDS);
        } catch (Exception e) {
            ready = false;
            log.warn("Video converter unavailable [VIDEO_STORAGE_CONFIGURATION]");
        }
    }

    private static Thread daemon(Runnable runnable, String name) {
        Thread thread = new Thread(runnable, name);
        thread.setDaemon(true);
        return thread;
    }

    public synchronized Capabilities capabilities() {
        // Cache checks; ordinary polling must not spawn new processes.
        if (ready && System.currentTimeMillis() - lastDependencyCheck > 30000) {
            dependencyAvailable = transcoder.available();
            lastDependencyCheck = System.currentTimeMillis();
        }
        boolean available = ready && dependencyAvailable && !closing;
        String reason = !config.isEnabled() ? "VIDEO_DISABLED" : !ready ? "VIDEO_STORAGE_CONFIGURATION"
                : !available ? "VIDEO_DEPENDENCY_UNAVAILABLE" : null;
        return new Capabilities(config.isEnabled(), available, reason, VideoTranscoder.INPUTS,
                VideoTranscoder.OUTPUTS, config.getMaxUploadBytes(), config.getMaxDurationSeconds(),
                config.getJobTtlMinutes());
    }

    public JobView submit(MultipartFile file, String target, String owner) {
        Capabilities cap = capabilities();
        if (!cap.available()) throw new VideoConversionException(503, cap.reason());
        if (!VideoTranscoder.OUTPUTS.contains(target)) throw new VideoConversionException(400, "VIDEO_TARGET_UNSUPPORTED");
        String original = Objects.toString(file.getOriginalFilename(), "");
        String extension = original.substring(original.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
        if (!VideoTranscoder.INPUTS.contains(extension)) throw new VideoConversionException(415, "VIDEO_INPUT_UNSUPPORTED");
        if (file.isEmpty()) throw new VideoConversionException(400, "VIDEO_INVALID_FILE");
        if (file.getSize() > config.getMaxUploadBytes()) throw new VideoConversionException(413, "VIDEO_TOO_LARGE");
        Job job;
        synchronized (jobs) {
            if (closing || jobs.size() >= config.getMaxRetainedJobs() || !slots.tryAcquire())
                throw new VideoConversionException(429, "VIDEO_QUEUE_FULL");
            job = new Job(UUID.randomUUID().toString(), owner, target);
            jobs.put(job.id, job);
        }
        try {
            Files.createDirectory(job.directory, permissions(job.directory, "rwx------"));
            // Marker distinguishes application-owned directories from unrelated files.
            Path marker = createPrivateFile(job.directory.resolve(".win-tools-job"));
            Files.writeString(marker, job.id);
            createPrivateFile(job.input);
            // FFmpeg truncates this existing file, retaining the permissions set at creation.
            createPrivateFile(job.output);
            try (var input = file.getInputStream(); var output = Files.newOutputStream(job.input)) {
                byte[] buffer = new byte[65536];
                long bytes = 0;
                int count;
                while ((count = input.read(buffer)) != -1) {
                    bytes += count;
                    if (bytes > config.getMaxUploadBytes()) throw new VideoConversionException(413, "VIDEO_TOO_LARGE");
                    output.write(buffer, 0, count);
                }
            }
            job.work = () -> run(job);
            executor.execute(job.work);
            log.info("Video task accepted [QUEUED]");
            return view(job);
        } catch (Exception e) {
            synchronized (job) {
                job.status = "FAILED";
                job.error = "VIDEO_STORAGE_UNAVAILABLE";
                job.finished = Instant.now();
                release(job);
                // Keep failed allocations tracked when disk errors prevent cleanup, even
                // if the ownership marker could not be written completely.
                if (removeDirectory(job.directory)) jobs.remove(job.id, job);
            }
            if (e instanceof VideoConversionException failure) throw failure;
            if (e instanceof RejectedExecutionException) throw new VideoConversionException(429, "VIDEO_QUEUE_FULL");
            throw new VideoConversionException(503, "VIDEO_STORAGE_UNAVAILABLE");
        }
    }

    private void run(Job job) {
        try {
            transition(job, "VALIDATING");
            double duration = transcoder.probe(job.input, job.cancelled);
            transition(job, "CONVERTING");
            transcoder.convert(job.input, job.output, job.target, duration, job.cancelled, progress -> {
                synchronized (job) { if (!job.cancelled.get()) job.progress = progress; }
            });
            synchronized (job) {
                if (!job.cancelled.get()) {
                    job.status = "COMPLETED";
                    job.progress = 100;
                    log.info("Video task finished [COMPLETED]");
                }
            }
        } catch (VideoConversionException e) {
            synchronized (job) {
                if (!job.cancelled.get()) { job.status = "FAILED"; job.error = e.getMessage(); }
            }
            log.info("Video task ended [{}]", e.getMessage());
        } catch (Exception e) {
            synchronized (job) {
                if (!job.cancelled.get()) { job.status = "FAILED"; job.error = "VIDEO_CONVERSION_FAILED"; }
            }
            log.warn("Video task failed [VIDEO_CONVERSION_FAILED]");
        } finally {
            synchronized (job) {
                job.finished = Instant.now();
                if (!job.status.equals("COMPLETED")) removeDirectory(job.directory);
                else {
                    try {
                        Files.deleteIfExists(job.input);
                        Files.setLastModifiedTime(job.directory.resolve(".win-tools-job"),
                                java.nio.file.attribute.FileTime.from(job.finished));
                    } catch (IOException e) { log.warn("Video cleanup failed [VIDEO_CLEANUP_FAILED]"); }
                }
            }
            release(job);
        }
    }

    private void transition(Job job, String status) {
        synchronized (job) {
            if (job.cancelled.get()) throw new VideoConversionException(409, "VIDEO_CANCELLED");
            job.status = status;
            log.info("Video task state [{}]", status);
        }
    }

    private void release(Job job) { if (job.released.compareAndSet(false, true)) slots.release(); }

    public JobView status(String id, String owner) { return view(owned(id, owner)); }

    private Job owned(String id, String owner) {
        Job job = jobs.get(id);
        if (job == null || !job.owner.equals(owner) || expired(job))
            throw new VideoConversionException(404, "VIDEO_JOB_NOT_FOUND");
        return job;
    }

    private boolean expired(Job job) {
        return job.finished != null && job.finished.plusSeconds(config.getJobTtlMinutes() * 60).isBefore(Instant.now());
    }

    private JobView view(Job job) {
        synchronized (job) {
            return new JobView(job.id, job.status, job.progress, job.target, job.error,
                    job.status.equals("COMPLETED") ? "/api/tools/video-converter/jobs/" + job.id + "/download" : null);
        }
    }

    public Download download(String id, String owner) {
        Job job = owned(id, owner);
        synchronized (job) {
            if (!job.status.equals("COMPLETED")) throw new VideoConversionException(409, "VIDEO_NOT_READY");
            try {
                long size = Files.size(job.output);
                if (size <= 0 || size > config.getMaxOutputBytes())
                    throw new VideoConversionException(422, "VIDEO_OUTPUT_INVALID");
                return new Download(new InputStreamResource(Files.newInputStream(job.output)), size,
                        "converted." + job.target);
            } catch (IOException e) { throw new VideoConversionException(404, "VIDEO_JOB_NOT_FOUND"); }
        }
    }

    public JobView cancel(String id, String owner) {
        Job job = owned(id, owner);
        synchronized (job) {
            boolean processFinished = job.status.equals("COMPLETED") || job.status.equals("FAILED");
            job.cancelled.set(true);
            job.status = "CANCELLED";
            job.error = null;
            job.progress = null;
            if (executor.remove(job.work)) release(job);
            // Running processes drain/terminate first; their finally block removes the files.
            if (processFinished || job.released.get()) removeDirectory(job.directory);
            job.finished = Instant.now();
        }
        log.info("Video task cancelled [VIDEO_CANCELLED]");
        return view(job);
    }

    public void cleanupExpired() {
        if (!ready) return;
        for (Job job : jobs.values()) {
            synchronized (job) {
                if (job.released.get() && expired(job) && removeDirectory(job.directory)) jobs.remove(job.id, job);
            }
        }
        // No recursive following of links; only UUID folders carrying this application's marker.
        try (var directories = Files.list(root)) {
            directories.filter(path -> path.getFileName().toString().matches("job-[0-9a-f-]{36}"))
                    .filter(path -> !jobs.containsKey(path.getFileName().toString().substring(4)))
                    .forEach(path -> {
                        try {
                            Path marker = path.resolve(".win-tools-job");
                            if (!Files.isSymbolicLink(path) && Files.isRegularFile(marker, LinkOption.NOFOLLOW_LINKS)
                                    && Files.readString(marker).equals(path.getFileName().toString().substring(4))
                                    && Files.getLastModifiedTime(marker).toInstant()
                                    .plusSeconds(config.getJobTtlMinutes() * 60).isBefore(Instant.now()))
                                removeDirectory(path);
                        } catch (IOException e) { log.warn("Video cleanup failed [VIDEO_CLEANUP_FAILED]"); }
                    });
        } catch (IOException e) { log.warn("Video cleanup failed [VIDEO_CLEANUP_FAILED]"); }
    }

    private boolean removeDirectory(Path directory) {
        if (!directory.getParent().equals(root) || Files.isSymbolicLink(directory)) return false;
        if (!Files.exists(directory)) return true;
        try (var paths = Files.walk(directory)) {
            Path marker = directory.resolve(".win-tools-job");
            // Keep the ownership marker until every payload has gone so startup cleanup can retry.
            for (Path path : paths.filter(path -> !path.equals(directory) && !path.equals(marker))
                    .sorted(Comparator.reverseOrder()).toList()) Files.deleteIfExists(path);
            Files.deleteIfExists(marker);
            Files.deleteIfExists(directory);
            return true;
        } catch (IOException e) {
            log.warn("Video cleanup failed [VIDEO_CLEANUP_FAILED]");
            return false;
        }
    }

    private static Path createPrivateFile(Path path) throws IOException {
        return Files.createFile(path, permissions(path, "rw-------"));
    }

    private static FileAttribute<?>[] permissions(Path path, String mode) throws IOException {
        Path existing = path;
        while (!Files.exists(existing, LinkOption.NOFOLLOW_LINKS)) existing = existing.getParent();
        return Files.getFileStore(existing).supportsFileAttributeView("posix")
                ? new FileAttribute<?>[]{PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString(mode))}
                : new FileAttribute<?>[0];
    }

    private static void restrict(Path path, String mode) throws IOException {
        if (Files.getFileStore(path).supportsFileAttributeView("posix"))
            Files.setPosixFilePermissions(path, PosixFilePermissions.fromString(mode));
    }

    @PreDestroy
    public void close() {
        closing = true;
        if (reaper != null) reaper.shutdownNow();
        if (executor != null) {
            jobs.values().forEach(job -> job.cancelled.set(true));
            List<Runnable> queued = executor.shutdownNow();
            jobs.values().forEach(job -> {
                synchronized (job) {
                    if (queued.contains(job.work)) {
                        job.status = "CANCELLED";
                        job.finished = Instant.now();
                        release(job);
                    }
                }
            });
            boolean interrupted = false;
            while (!executor.isTerminated()) {
                try { executor.awaitTermination(1, TimeUnit.SECONDS); }
                catch (InterruptedException e) { interrupted = true; }
            }
            // A worker returns only after its external process has terminated. Uploads still
            // being copied are not released; submit's rejection path performs their cleanup.
            jobs.values().forEach(job -> {
                synchronized (job) { if (job.released.get()) removeDirectory(job.directory); }
            });
            if (interrupted) Thread.currentThread().interrupt();
        }
    }

    private class Job {
        final String id, owner, target;
        final Path directory, input, output;
        final AtomicBoolean cancelled = new AtomicBoolean(), released = new AtomicBoolean();
        String status = "QUEUED", error;
        Integer progress;
        volatile Instant finished;
        volatile Runnable work;
        Job(String id, String owner, String target) {
            this.id = id; this.owner = owner; this.target = target;
            directory = root.resolve(PREFIX + id);
            input = directory.resolve("input.bin");
            output = directory.resolve("output." + target);
        }
    }
}
