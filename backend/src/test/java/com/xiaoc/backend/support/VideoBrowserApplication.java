package com.xiaoc.backend.support;

import com.xiaoc.backend.BackendApplication;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.core.io.FileSystemResource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import javax.sql.DataSource;

/** Local opt-in browser fixture; H2 only, never packaged in the production Jar. */
public class VideoBrowserApplication {
    public static void main(String[] args) {
        SpringApplication app = new SpringApplication(BackendApplication.class, Fixture.class);
        app.setAdditionalProfiles("test");
        app.run("--server.address=127.0.0.1", "--server.port=18081",
                "--spring.datasource.url=jdbc:h2:mem:video_browser;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
                "--spring.datasource.driver-class-name=org.h2.Driver", "--spring.datasource.username=sa", "--spring.datasource.password=",
                "--spring.sql.init.mode=always", "--spring.sql.init.schema-locations=classpath:sql/schema-h2.sql",
                "--win-tools.video-converter.enabled=true", "--win-tools.video-converter.temp-dir=target/video-browser-jobs");
    }
    @TestConfiguration(proxyBeanMethods = false)
    static class Fixture {
        @Bean CommandLineRunner catalog(DataSource dataSource) {
            return args -> {
                var seed = new ResourceDatabasePopulator(new FileSystemResource("../sql/seed-dev.sql"));
                seed.setSqlScriptEncoding("UTF-8"); seed.execute(dataSource);
            };
        }
    }
}
