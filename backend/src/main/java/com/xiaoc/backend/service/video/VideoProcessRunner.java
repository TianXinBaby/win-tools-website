package com.xiaoc.backend.service.video;

import com.xiaoc.backend.exception.VideoConversionException;
import jakarta.annotation.PreDestroy;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;

/** No shell; bounded output, continuous drain, cancellation and process-tree termination. */
@Component
public class VideoProcessRunner {
    private final Map<Process, Set<ProcessHandle>> active = new ConcurrentHashMap<>();
    private volatile boolean closing;

    public String run(List<String> arguments, long timeoutMillis, AtomicBoolean cancelled,
                      Consumer<String> onLine) {
        Process process = null;
        Thread reader = null;
        StringBuilder captured = new StringBuilder();
        try {
            synchronized (active) {
                if (cancelled.get() || closing) throw new VideoConversionException(409, "VIDEO_CANCELLED");
                process = new ProcessBuilder(arguments).redirectErrorStream(true).start();
                active.put(process, ConcurrentHashMap.newKeySet());
            }
            process.getOutputStream().close();
            InputStream stream = process.getInputStream();
            reader = new Thread(() -> drain(stream, captured, onLine), "video-process-output");
            reader.setDaemon(true);
            reader.start();
            long deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(timeoutMillis);
            while (true) {
                collectDescendants(process, active.get(process));
                if (process.waitFor(100, TimeUnit.MILLISECONDS)) break;
                if (cancelled.get() || closing || Thread.currentThread().isInterrupted())
                    throw new VideoConversionException(409, "VIDEO_CANCELLED");
                if (System.nanoTime() >= deadline)
                    throw new VideoConversionException(422, "VIDEO_TIMEOUT");
            }
            reader.join(2000);
            if (cancelled.get() || closing) throw new VideoConversionException(409, "VIDEO_CANCELLED");
            if (process.exitValue() != 0) throw new VideoConversionException(422, "VIDEO_PROCESS_FAILED");
            synchronized (captured) { return captured.toString(); }
        } catch (java.io.IOException e) {
            throw new VideoConversionException(503, "VIDEO_DEPENDENCY_UNAVAILABLE");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new VideoConversionException(409, "VIDEO_CANCELLED");
        } finally {
            if (process != null) {
                // Files may be deleted as soon as run returns. An interrupted caller must
                // therefore still wait for the external process and its children to exit.
                terminateAndWait(process, active.get(process));
                try { process.getInputStream().close(); }
                catch (java.io.IOException ignored) { /* The process has already exited. */ }
                joinReader(reader);
                active.remove(process);
            }
        }
    }

    private static void collectDescendants(Process process, Set<ProcessHandle> descendants) {
        process.descendants().forEach(descendants::add);
        for (ProcessHandle child : List.copyOf(descendants))
            if (child.isAlive()) child.descendants().forEach(descendants::add);
    }

    private static void terminateAndWait(Process process, Set<ProcessHandle> descendants) {
        boolean interrupted = Thread.interrupted();
        try {
            long childrenDeadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(200);
            do {
                collectDescendants(process, descendants);
                descendants.stream().filter(ProcessHandle::isAlive).forEach(ProcessHandle::destroyForcibly);
                // Leave the parent a brief chance to reap children before terminating it.
                if (process.isAlive() && (descendants.stream().noneMatch(ProcessHandle::isAlive)
                        || System.nanoTime() >= childrenDeadline)) process.destroyForcibly();
                if (!process.isAlive() && descendants.stream().noneMatch(ProcessHandle::isAlive)) break;
                try { Thread.sleep(10); }
                catch (InterruptedException e) { interrupted = true; }
            } while (true);
            // Reap the root process as well as observing its ProcessHandle state.
            boolean exited = false;
            while (!exited) {
                try { process.waitFor(); exited = true; }
                catch (InterruptedException e) { interrupted = true; }
            }
        } finally {
            if (interrupted) Thread.currentThread().interrupt();
        }
    }

    private static void joinReader(Thread reader) {
        if (reader == null) return;
        boolean interrupted = Thread.interrupted();
        try {
            while (reader.isAlive()) {
                try { reader.join(); }
                catch (InterruptedException e) { interrupted = true; }
            }
        } finally {
            if (interrupted) Thread.currentThread().interrupt();
        }
    }

    @PreDestroy
    public void close() {
        Map<Process, Set<ProcessHandle>> running;
        synchronized (active) {
            closing = true;
            running = Map.copyOf(active);
        }
        running.forEach(VideoProcessRunner::terminateAndWait);
    }

    private void drain(InputStream stream, StringBuilder captured, Consumer<String> onLine) {
        try (stream) {
            byte[] buffer = new byte[2048];
            StringBuilder line = new StringBuilder();
            int count;
            while ((count = stream.read(buffer)) != -1) {
                String part = new String(buffer, 0, count, StandardCharsets.UTF_8);
                synchronized (captured) {
                    int remaining = 65536 - captured.length();
                    if (remaining > 0) captured.append(part, 0, Math.min(part.length(), remaining));
                }
                for (char c : part.toCharArray()) {
                    if (c == '\n' || c == '\r') {
                        onLine.accept(line.toString());
                        line.setLength(0);
                    } else if (line.length() < 2048) line.append(c);
                }
            }
        } catch (java.io.IOException ignored) { /* Closing a cancelled process closes the pipe. */ }
    }
}
