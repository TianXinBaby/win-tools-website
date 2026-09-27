package com.xiaoc.backend.controller;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.LoggerContext;
import ch.qos.logback.core.rolling.RollingFileAppender;
import ch.qos.logback.core.rolling.SizeAndTimeBasedRollingPolicy;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.xiaoc.backend.mapper.AdminUserMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.web.ServerProperties;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.core.env.Environment;
import org.springframework.http.*;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.slf4j.LoggerFactory;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.datasource.url=jdbc:h2:mem:production_config_test",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "DB_USERNAME=production-test-only", "DB_PASSWORD=production-test-only"
})
@ActiveProfiles("prod")
class ProductionHardeningTests {

    @Autowired private TestRestTemplate client;
    @Autowired private ObjectMapper json;
    @Autowired private ServerProperties server;
    @Autowired private Environment environment;
    @MockitoBean private AdminUserMapper admins;

    @Test
    void healthIsAnonymousExactSafeJsonWithoutSessionOrDatabase() throws Exception {
        ResponseEntity<String> response = client.getForEntity("/api/health", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(json.readTree(response.getBody())).isEqualTo(json.readTree("""
                {"code":200,"message":"success","data":{"status":"UP"}}
                """));
        assertThat(response.getHeaders().getCacheControl()).isEqualTo("no-store");
        assertThat(response.getHeaders().get(HttpHeaders.SET_COOKIE)).isNull();
        verifyNoInteractions(admins);
    }

    @Test
    void actuatorOnlyExposesSanitizedHealthAndInfo() throws Exception {
        ResponseEntity<String> health = client.getForEntity("/actuator/health", String.class);
        assertThat(health.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(health.getBody()).isEqualTo("{\"status\":\"UP\"}");
        assertThat(json.readTree(health.getBody())).isEqualTo(json.readTree("{\"status\":\"UP\"}"));
        assertThat(health.getHeaders().get(HttpHeaders.SET_COOKIE)).isNull();

        ResponseEntity<String> info = client.getForEntity("/actuator/info", String.class);
        assertThat(info.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(json.readTree(info.getBody())).isEqualTo(json.readTree("{}"));

        for (String path : new String[] {"/actuator", "/actuator/metrics", "/actuator/env", "/actuator/logfile"}) {
            assertThat(client.getForEntity(path, String.class).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        }
    }

    @Test
    void logbackWritesRollingApplicationAndErrorFiles() throws Exception {
        Logger root = ((LoggerContext) LoggerFactory.getILoggerFactory()).getLogger(Logger.ROOT_LOGGER_NAME);
        assertThat(root.getAppender("APPLICATION_FILE")).isInstanceOf(RollingFileAppender.class);
        assertThat(root.getAppender("ERROR_FILE")).isInstanceOf(RollingFileAppender.class);
        RollingFileAppender<?> application = (RollingFileAppender<?>) root.getAppender("APPLICATION_FILE");
        RollingFileAppender<?> error = (RollingFileAppender<?>) root.getAppender("ERROR_FILE");
        assertThat(application.getRollingPolicy()).isInstanceOf(SizeAndTimeBasedRollingPolicy.class);
        assertThat(error.getRollingPolicy()).isInstanceOf(SizeAndTimeBasedRollingPolicy.class);
        assertThat(((SizeAndTimeBasedRollingPolicy<?>) application.getRollingPolicy()).getMaxHistory()).isEqualTo(14);
        assertThat(((SizeAndTimeBasedRollingPolicy<?>) error.getRollingPolicy()).getMaxHistory()).isEqualTo(14);
        assertThat(((SizeAndTimeBasedRollingPolicy<?>) application.getRollingPolicy()).getFileNamePattern())
                .contains("application.%d{yyyy-MM-dd}.%i.log.gz");
        assertThat(((SizeAndTimeBasedRollingPolicy<?>) error.getRollingPolicy()).getFileNamePattern())
                .contains("error.%d{yyyy-MM-dd}.%i.log.gz");

        String marker = UUID.randomUUID().toString();
        org.slf4j.Logger logger = LoggerFactory.getLogger(ProductionHardeningTests.class);
        logger.info("application-log-test-{}", marker);
        logger.error("error-log-test-{}", marker);
        String applicationText = Files.readString(Path.of(application.getFile()));
        String errorText = Files.readString(Path.of(error.getFile()));
        assertThat(applicationText).contains("application-log-test-" + marker, "error-log-test-" + marker);
        assertThat(errorText).contains("error-log-test-" + marker).doesNotContain("application-log-test-" + marker);
    }

    @Test
    void realContainerCookieHasProductionFlagsAndNoSessionIdInJson() throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Forwarded-Proto", "https");
        ResponseEntity<String> response = client.exchange("/api/admin/auth/csrf", HttpMethod.GET,
                new HttpEntity<>(headers), String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        String cookie = response.getHeaders().getFirst(HttpHeaders.SET_COOKIE);
        assertThat(cookie).contains("JSESSIONID=", "Secure", "HttpOnly", "SameSite=Lax");
        String sessionId = cookie.substring(cookie.indexOf('=') + 1, cookie.indexOf(';'));
        assertThat(response.getBody()).doesNotContain(sessionId, "JSESSIONID");
        JsonNode data = json.readTree(response.getBody()).get("data");
        assertThat(data.size()).isEqualTo(2);
        // Only emitted for a secure request: proves framework forwarded-header handling.
        assertThat(response.getHeaders().getFirst("Strict-Transport-Security")).isNotBlank();
    }

    @Test
    void productionConfigurationBindsSafely() {
        assertThat(server.getAddress().isLoopbackAddress()).isTrue();
        assertThat(server.getForwardHeadersStrategy()).isEqualTo(ServerProperties.ForwardHeadersStrategy.FRAMEWORK);
        assertThat(server.getServlet().getSession().getTimeout()).isEqualTo(Duration.ofMinutes(30));
        assertThat(server.getServlet().getSession().getCookie().getHttpOnly()).isTrue();
        assertThat(server.getServlet().getSession().getCookie().getSecure()).isTrue();
        assertThat(environment.getProperty("spring.sql.init.mode")).isEqualTo("never");
        assertThat(environment.getProperty("logging.level.root")).isEqualTo("INFO");
        assertThat(environment.getProperty("mybatis-plus.configuration.log-impl"))
                .isEqualTo("org.apache.ibatis.logging.nologging.NoLoggingImpl");
    }

    @ParameterizedTest
    @ValueSource(strings = {"/api/admin/auth/me", "/api/admin/windows", "/api/admin/tools", "/api/admin/articles"})
    void anonymousAdminRemainsUnauthorizedWithSafeHeaders(String path) throws Exception {
        ResponseEntity<String> response = client.getForEntity(path, String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(json.readTree(response.getBody())).isEqualTo(json.readTree("""
                {"code":401,"message":"Unauthorized","data":null}
                """));
        assertThat(response.getHeaders().getFirst("X-Content-Type-Options")).isEqualTo("nosniff");
        assertThat(response.getHeaders().getFirst("X-Frame-Options")).isEqualTo("DENY");
        assertThat(response.getHeaders().getFirst("Referrer-Policy")).isEqualTo("strict-origin-when-cross-origin");
        // CSP is deliberately supplied by Nginx only.
        assertThat(response.getHeaders().getFirst("Content-Security-Policy")).isNull();
    }

    @ParameterizedTest
    @ValueSource(strings = {"/api/admin/auth/login", "/api/admin/auth/logout", "/api/admin/articles"})
    void productionPostStillRequiresCsrf(String path) throws Exception {
        ResponseEntity<String> response = client.postForEntity(path, null, String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(json.readTree(response.getBody())).isEqualTo(json.readTree("""
                {"code":403,"message":"Forbidden","data":null}
                """));
    }

    @Test
    void crossOriginDoesNotReceiveCorsPermission() {
        HttpHeaders headers = new HttpHeaders();
        headers.setOrigin("https://untrusted.example");
        ResponseEntity<String> response = client.exchange("/api/admin/auth/csrf", HttpMethod.GET,
                new HttpEntity<>(headers), String.class);
        assertThat(response.getHeaders().getAccessControlAllowOrigin()).isNull();
        assertThat(response.getHeaders().getAccessControlAllowCredentials()).isFalse();
    }

    @Test
    void containerErrorIgnoresTraceParametersAndHtmlAccept() throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.setAccept(java.util.List.of(MediaType.TEXT_HTML, MediaType.ALL));
        ResponseEntity<String> response = client.exchange("/error?trace=true&message=true", HttpMethod.GET,
                new HttpEntity<>(headers), String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(json.readTree(response.getBody())).isEqualTo(json.readTree("""
                {"code":500,"message":"Internal Server Error","data":null}
                """));
    }
}
