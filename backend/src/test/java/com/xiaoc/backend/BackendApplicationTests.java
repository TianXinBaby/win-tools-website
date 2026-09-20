package com.xiaoc.backend;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
class BackendApplicationTests {

    @Autowired
    private ApplicationContext context;

    @Test
    void contextLoads() {
        assertThat(context.getBean(BackendApplication.class)).isNotNull();
        assertThat(context.getEnvironment().getProperty("spring.application.name")).isEqualTo("backend");
        assertThat(context.getEnvironment().getProperty("server.port")).isEqualTo("8080");
    }
}
