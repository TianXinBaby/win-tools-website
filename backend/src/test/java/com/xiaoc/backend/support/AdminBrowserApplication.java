package com.xiaoc.backend.support;

import com.xiaoc.backend.BackendApplication;
import com.xiaoc.backend.entity.AdminUser;
import com.xiaoc.backend.mapper.AdminUserMapper;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.security.crypto.password.PasswordEncoder;

/** Opt-in, loopback-only browser fixture. Never packaged in the application Jar. */
public class AdminBrowserApplication {

    public static void main(String[] args) {
        SpringApplication app = new SpringApplication(BackendApplication.class, Fixture.class);
        app.setAdditionalProfiles("test");
        // Fixed command-line properties prevent this fixture from using a real datasource.
        app.run("--server.address=127.0.0.1", "--server.port=8080",
                "--spring.datasource.url=jdbc:h2:mem:admin_browser;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
                "--spring.datasource.driver-class-name=org.h2.Driver",
                "--spring.datasource.username=sa", "--spring.datasource.password=",
                "--spring.sql.init.mode=always", "--spring.sql.init.schema-locations=classpath:sql/schema-h2.sql");
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class Fixture {
        @Bean
        CommandLineRunner browserAdmin(AdminUserMapper admins, PasswordEncoder encoder) {
            return args -> {
                AdminUser admin = new AdminUser();
                admin.setUsername("browser-test-admin");
                admin.setPassword(encoder.encode(" browser-test-only passphrase "));
                admin.setNickname("浏览器测试管理员");
                admin.setStatus(1);
                admins.insert(admin);
            };
        }
    }
}
