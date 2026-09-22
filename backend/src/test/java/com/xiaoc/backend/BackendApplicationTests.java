package com.xiaoc.backend;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.boot.autoconfigure.web.ServerProperties;
import org.springframework.boot.web.server.Cookie.SameSite;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
class BackendApplicationTests {

    @Autowired
    private ApplicationContext context;

    @Autowired
    private ServerProperties serverProperties;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Test
    void contextLoads() {
        assertThat(context.getBean(BackendApplication.class)).isNotNull();
        assertThat(context.getEnvironment().getProperty("spring.application.name")).isEqualTo("backend");
        assertThat(context.getEnvironment().getProperty("server.port")).isEqualTo("8080");
    }

    @Test
    void sessionCookieDefaultsAndTimeoutAreSafeForLocalHttp() {
        var session = serverProperties.getServlet().getSession();
        assertThat(session.getTimeout()).isEqualTo(Duration.ofMinutes(30));
        assertThat(session.getCookie().getHttpOnly()).isTrue();
        assertThat(session.getCookie().getSameSite()).isEqualTo(SameSite.LAX);
        assertThat(session.getCookie().getSecure()).isFalse();
        assertThat(session.getTrackingModes()).extracting(Enum::name).containsExactly("COOKIE");
    }

    @Test
    void productionPasswordEncoderUsesBcryptStrength12() {
        String hash = passwordEncoder.encode("test-only-encoder-probe");
        assertThat(hash).startsWith("$2a$12$");
        assertThat(passwordEncoder.matches("test-only-encoder-probe", hash)).isTrue();
    }
}
