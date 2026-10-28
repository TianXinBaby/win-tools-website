package com.xiaoc.backend.service.video;

import org.junit.jupiter.api.Test;
import java.nio.file.Path;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import static org.assertj.core.api.Assertions.*;

class VideoProcessRunnerTests {
    final VideoProcessRunner runner = new VideoProcessRunner();
    static List<String> child(String mode) {
        return List.of(Path.of(System.getProperty("java.home"), "bin", "java").toString(),
                "-cp", System.getProperty("java.class.path"), Child.class.getName(), mode);
    }
    @Test void missingExecutable() {
        assertThatThrownBy(() -> runner.run(List.of("nonexistent-video-binary-40251"), 1000,
                new AtomicBoolean(), line -> {})).hasMessage("VIDEO_DEPENDENCY_UNAVAILABLE");
    }
    @Test void drainsAndBoundsLargeOutput() {
        assertThat(runner.run(child("output"), 10000, new AtomicBoolean(), line -> {})).hasSize(65536);
    }
    @Test void timeout() {
        assertThatThrownBy(() -> runner.run(child("sleep"), 200, new AtomicBoolean(), line -> {})).hasMessage("VIDEO_TIMEOUT");
    }
    @Test void cancel() {
        AtomicBoolean cancelled = new AtomicBoolean();
        assertThatThrownBy(() -> runner.run(child("sleep"), 10000, cancelled, line -> cancelled.set(true))).hasMessage("VIDEO_CANCELLED");
    }
    @Test void nonzeroExit() {
        assertThatThrownBy(() -> runner.run(child("fail"), 10000, new AtomicBoolean(), line -> {})).hasMessage("VIDEO_PROCESS_FAILED");
    }
    @Test void timeoutWaitsForParentAndDescendantExit() {
        Set<Long> pids = ConcurrentHashMap.newKeySet();
        assertThatThrownBy(() -> runner.run(child("tree"), 2000, new AtomicBoolean(), line -> recordPid(line, pids)))
                .hasMessage("VIDEO_TIMEOUT");
        assertExited(pids, 2);
    }
    @Test void cancellationWaitsForParentAndDescendantExit() {
        Set<Long> pids = ConcurrentHashMap.newKeySet();
        AtomicBoolean cancelled = new AtomicBoolean();
        assertThatThrownBy(() -> runner.run(child("tree"), 10000, cancelled, line -> {
            recordPid(line, pids);
            if (pids.size() == 2) cancelled.set(true);
        })).hasMessage("VIDEO_CANCELLED");
        assertExited(pids, 2);
    }
    @Test void interruptionWaitsForExitAndPreservesInterrupt() throws Exception {
        Set<Long> pids = ConcurrentHashMap.newKeySet();
        CountDownLatch started = new CountDownLatch(1);
        AtomicBoolean preserved = new AtomicBoolean();
        AtomicReference<Throwable> failure = new AtomicReference<>();
        Thread worker = new Thread(() -> {
            try { runner.run(child("tree"), 10000, new AtomicBoolean(), line -> {
                recordPid(line, pids);
                if (pids.size() == 2) started.countDown();
            }); } catch (Throwable e) { failure.set(e); }
            finally { preserved.set(Thread.currentThread().isInterrupted()); }
        });
        worker.start();
        try {
            assertThat(started.await(5, TimeUnit.SECONDS)).isTrue();
            worker.interrupt();
            worker.join(5000);
            assertThat(worker.isAlive()).isFalse();
            assertThat(failure.get()).hasMessage("VIDEO_CANCELLED");
            assertThat(preserved).isTrue();
            assertExited(pids, 2);
        } finally { runner.close(); worker.join(5000); }
    }
    @Test void successfulParentDoesNotLeaveTrackedChildRunning() {
        Set<Long> pids = ConcurrentHashMap.newKeySet();
        runner.run(child("orphan"), 10000, new AtomicBoolean(), line -> recordPid(line, pids));
        assertExited(pids, 2);
    }
    @Test void closeWaitsForAllProcessesAndRejectsNewStarts() throws Exception {
        Set<Long> pids = ConcurrentHashMap.newKeySet();
        CountDownLatch started = new CountDownLatch(1);
        Thread worker = new Thread(() -> {
            try { runner.run(child("tree"), 10000, new AtomicBoolean(), line -> {
                recordPid(line, pids);
                if (pids.size() == 2) started.countDown();
            }); } catch (com.xiaoc.backend.exception.VideoConversionException ignored) { }
        });
        worker.start();
        try {
            assertThat(started.await(5, TimeUnit.SECONDS)).isTrue();
            runner.close();
            assertExited(pids, 2);
            worker.join(5000);
            assertThat(worker.isAlive()).isFalse();
            assertThatThrownBy(() -> runner.run(child("sleep"), 10000, new AtomicBoolean(), line -> {}))
                    .hasMessage("VIDEO_CANCELLED");
        } finally { runner.close(); worker.join(5000); }
    }
    private static void recordPid(String line, Set<Long> pids) {
        if (line.startsWith("pid=")) pids.add(Long.parseLong(line.substring(4)));
    }
    private static void assertExited(Set<Long> pids, int count) {
        assertThat(pids).hasSize(count);
        assertThat(pids).allMatch(pid -> ProcessHandle.of(pid).map(handle -> !handle.isAlive()).orElse(true));
    }
    public static class Child {
        public static void main(String[] args) throws Exception {
            if (args[0].equals("output")) for (int i=0; i<10000; i++) System.out.println("progress-test-1234567890");
            else if (args[0].equals("sleep")) { System.out.println("started"); System.out.flush(); Thread.sleep(30000); }
            else if (args[0].equals("tree") || args[0].equals("orphan")) {
                System.out.println("pid=" + ProcessHandle.current().pid());
                Process descendant = new ProcessBuilder(child("leaf")).inheritIO().start();
                System.out.println("pid=" + descendant.pid());
                System.out.flush();
                Thread.sleep(args[0].equals("orphan") ? 500 : 30000);
            }
            else if (args[0].equals("leaf")) Thread.sleep(30000);
            else { System.err.println("private path"); System.exit(2); }
        }
    }
}
