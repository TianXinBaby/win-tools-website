package com.xiaoc.backend.support;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.io.Console;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

/** Explicit offline operator utility; test scope keeps it out of the production Jar. */
public final class AdminPasswordHash {
    private AdminPasswordHash() { }

    public static void main(String[] args) {
        Console console = System.console();
        if (console == null || args.length != 0) {
            throw new IllegalStateException("Use an interactive terminal without command-line credentials");
        }
        char[] password = console.readPassword("Administrator password (hidden): ");
        char[] confirm = console.readPassword("Confirm password (hidden): ");
        try {
            if (password == null || confirm == null || !Arrays.equals(password, confirm)) {
                throw new IllegalArgumentException("Password confirmation failed");
            }
            console.printf("%s%n", encode(new String(password)));
        } finally {
            if (password != null) Arrays.fill(password, '\0');
            if (confirm != null) Arrays.fill(confirm, '\0');
        }
    }

    static String encode(String password) {
        if (password.isBlank() || password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new IllegalArgumentException("Use a nonblank password of at most 72 UTF-8 bytes");
        }
        return new BCryptPasswordEncoder(12).encode(password);
    }
}
