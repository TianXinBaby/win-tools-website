package com.xiaoc.backend.support;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AdminPasswordHashTests {
    @Test
    void offlineHashMatchesProjectEncoderWithoutTrimmingPassword() {
        String input = " offline-test-only passphrase ";
        String hash = AdminPasswordHash.encode(input);
        assertThat(hash).startsWith("$2a$12$");
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(12);
        assertThat(encoder.matches(input, hash)).isTrue();
        assertThat(encoder.matches(input.trim(), hash)).isFalse();
    }

    @ParameterizedTest
    @ValueSource(strings = {"", " ", "\t"})
    void rejectsBlankPasswords(String password) {
        assertThatThrownBy(() -> AdminPasswordHash.encode(password)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsPasswordsBeyondBcryptByteLimit() {
        assertThatThrownBy(() -> AdminPasswordHash.encode("测".repeat(25)))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
