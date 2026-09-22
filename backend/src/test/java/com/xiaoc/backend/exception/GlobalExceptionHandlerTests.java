package com.xiaoc.backend.exception;

import org.junit.jupiter.api.Test;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import com.xiaoc.backend.config.SecurityConfig;
import com.xiaoc.backend.service.AdminUserDetailsService;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(GlobalExceptionHandlerTests.FailingController.class)
@Import({GlobalExceptionHandlerTests.FailingController.class, SecurityConfig.class})
class GlobalExceptionHandlerTests {

    @MockitoBean
    private AdminUserDetailsService adminUserDetailsService;

    @Autowired
    private MockMvc mockMvc;

    @Test
    void unexpectedExceptionReturnsSafeJson() throws Exception {
        mockMvc.perform(get("/api/test/failure"))
                .andExpect(status().isInternalServerError())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(content().json("""
                        {"code":500,"message":"Internal server error","data":null}
                        """))
                .andExpect(jsonPath("$.trace").doesNotExist())
                .andExpect(content().string(not(containsString("private failure detail"))))
                .andExpect(content().string(not(containsString("IllegalStateException"))));
    }

    @RestController
    static class FailingController {

        @GetMapping("/api/test/duplicate")
        public void duplicate() {
            throw new DuplicateKeyException("private SQL constraint detail");
        }

        @GetMapping("/api/test/failure")
        public void fail() {
            throw new IllegalStateException("private failure detail");
        }
    }

    @Test
    void concurrentUniqueConstraintFailureReturnsSafe409() throws Exception {
        mockMvc.perform(get("/api/test/duplicate"))
                .andExpect(status().isConflict())
                .andExpect(content().json("""
                        {"code":409,"message":"Resource already exists","data":null}
                        """))
                .andExpect(content().string(not(containsString("SQL"))));
    }
}
