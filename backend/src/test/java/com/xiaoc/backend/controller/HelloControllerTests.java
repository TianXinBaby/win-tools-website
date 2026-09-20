package com.xiaoc.backend.controller;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(HelloController.class)
class HelloControllerTests {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void helloReturnsSuccessResponse() throws Exception {
        mockMvc.perform(get("/api/hello"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.message").value("success"))
                .andExpect(jsonPath("$.data").value("Hello Win Tools!"));
    }

    @Test
    void unsupportedMethodKeepsMethodNotAllowedStatus() throws Exception {
        mockMvc.perform(post("/api/hello"))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(header().exists("Allow"))
                .andExpect(jsonPath("$.code").value(405))
                .andExpect(jsonPath("$.message").value("Method Not Allowed"));
    }

    @Test
    void unknownPathKeepsNotFoundStatus() throws Exception {
        mockMvc.perform(get("/api/missing"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(404))
                .andExpect(jsonPath("$.message").value("Not Found"));
    }
}
