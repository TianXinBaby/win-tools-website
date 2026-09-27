package com.xiaoc.backend.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.core.io.ClassPathResource;

import java.io.IOException;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ProductionConfigurationTests {

    private StandardEnvironment config(String resource) throws IOException {
        StandardEnvironment environment = new StandardEnvironment();
        environment.getPropertySources().remove(StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME);
        environment.getPropertySources().remove(StandardEnvironment.SYSTEM_PROPERTIES_PROPERTY_SOURCE_NAME);
        new YamlPropertySourceLoader().load("config", new ClassPathResource(resource))
                .forEach(source -> environment.getPropertySources().addLast(source));
        return environment;
    }

    @Test
    void productionHasNoFallbackDatabaseCredentials() throws Exception {
        StandardEnvironment environment = config("application-prod.yml");
        assertThatThrownBy(() -> environment.getRequiredProperty("spring.datasource.username"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> environment.getRequiredProperty("spring.datasource.password"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void productionDatabaseUsesSuppliedEnvironmentAndSafeDefaults() throws Exception {
        StandardEnvironment environment = config("application-prod.yml");
        environment.getPropertySources().addFirst(new MapPropertySource("test-env", Map.of(
                "DB_HOST", "db.internal", "DB_PORT", "3307", "DB_NAME", "deployment_test",
                "DB_USERNAME", "app-test-only", "DB_PASSWORD", "placeholder-test-only")));
        assertThat(environment.getProperty("spring.datasource.url"))
                .isEqualTo("jdbc:mysql://db.internal:3307/deployment_test?characterEncoding=UTF-8");
        assertThat(environment.getProperty("spring.datasource.username")).isEqualTo("app-test-only");
        assertThat(environment.getProperty("spring.datasource.password")).isEqualTo("placeholder-test-only");
        assertThat(environment.getProperty("server.port")).isEqualTo("8080");
        assertThat(environment.getProperty("server.servlet.session.cookie.secure")).isEqualTo("true");
    }

    @Test
    void localHttpDevelopmentStillDefaultsToNonSecureCookie() throws Exception {
        assertThat(config("application.yml").getProperty("server.servlet.session.cookie.secure"))
                .isEqualTo("false");
    }

    @Test
    void actuatorAccessAndLogDirectoryHaveSafeDefaults() throws Exception {
        StandardEnvironment environment = config("application.yml");
        assertThat(environment.getProperty("management.endpoints.access.default")).isEqualTo("none");
        assertThat(environment.getProperty("management.endpoints.access.max-permitted")).isEqualTo("read-only");
        assertThat(environment.getProperty("management.endpoints.web.exposure.include")).isEqualTo("health,info");
        assertThat(environment.getProperty("management.endpoints.web.discovery.enabled")).isEqualTo("false");
        assertThat(environment.getProperty("management.endpoints.jmx.exposure.exclude")).isEqualTo("*");
        assertThat(environment.getProperty("management.endpoint.health.show-details")).isEqualTo("never");
        assertThat(environment.getProperty("management.endpoint.health.show-components")).isEqualTo("never");
        assertThat(environment.getProperty("logging.file.path")).isEqualTo("logs");
        environment.getPropertySources().addFirst(new MapPropertySource("log-dir", Map.of(
                "WIN_TOOLS_LOG_DIR", "/opt/win-tools/logs")));
        assertThat(environment.getProperty("logging.file.path")).isEqualTo("/opt/win-tools/logs");
    }
}
