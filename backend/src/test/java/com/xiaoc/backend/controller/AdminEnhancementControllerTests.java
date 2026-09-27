package com.xiaoc.backend.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class AdminEnhancementControllerTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;

    private JsonNode adminGet(String path) throws Exception {
        return json.readTree(mvc.perform(get(path).with(user("admin").roles("ADMIN")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(200))
                .andReturn().getResponse().getContentAsString()).get("data");
    }

    private JsonNode adminPut(String path, String body) throws Exception {
        return json.readTree(mvc.perform(put(path).with(user("admin").roles("ADMIN"))
                        .with(csrf()).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(200))
                .andReturn().getResponse().getContentAsString()).get("data");
    }

    @Test
    void dashboardCountsAllToolsArticlesAndNonemptyCategories() throws Exception {
        jdbc.update("INSERT INTO tool (name, slug, path, category, status) VALUES (?, ?, ?, ?, ?)",
                "One", "one", "/tools/one", "development", 1);
        jdbc.update("INSERT INTO tool (name, slug, path, category, status) VALUES (?, ?, ?, ?, ?)",
                "Two", "two", "/tools/two", "development", 0);
        jdbc.update("INSERT INTO tool (name, slug, path, category, status) VALUES (?, ?, ?, ?, ?)",
                "Three", "three", "/tools/three", null, 1);
        jdbc.update("INSERT INTO article (title, slug, status) VALUES (?, ?, ?)", "Draft", "draft", 0);
        jdbc.update("INSERT INTO article (title, slug, status) VALUES (?, ?, ?)", "Live", "live", 1);

        JsonNode stats = adminGet("/api/admin/dashboard/stats");
        assertThat(stats.get("toolTotal").asLong()).isEqualTo(3);
        assertThat(stats.get("toolEnabled").asLong()).isEqualTo(2);
        assertThat(stats.get("toolDisabled").asLong()).isEqualTo(1);
        assertThat(stats.get("articleTotal").asLong()).isEqualTo(2);
        assertThat(stats.get("articlePublished").asLong()).isEqualTo(1);
        assertThat(stats.get("categoryCount").asLong()).isEqualTo(1);
    }

    @Test
    void focusedToolUpdatesChangePublicVisibilityAndOrderWithoutChangingOtherFields() throws Exception {
        jdbc.update("INSERT INTO tool (name, slug, path, category, status, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
                "First", "first", "/tools/first", "development", 1, 20);
        jdbc.update("INSERT INTO tool (name, slug, path, category, status, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
                "Second", "second", "/tools/second", "fun", 1, 10);
        long id = jdbc.queryForObject("SELECT id FROM tool WHERE slug = 'first'", Long.class);
        String base = "/api/admin/tools/" + id;

        JsonNode sorted = adminPut(base + "/sort", "{\"sortOrder\":0}");
        assertThat(sorted.get("sortOrder").asInt()).isZero();
        assertThat(sorted.get("name").asText()).isEqualTo("First");
        assertThat(adminGet("/api/admin/tools").get(0).get("id").asLong()).isEqualTo(id);
        JsonNode publicTools = json.readTree(mvc.perform(get("/api/tools"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("data");
        assertThat(publicTools.get(0).get("slug").asText()).isEqualTo("first");

        assertThat(adminPut(base + "/status", "{\"status\":0}").get("status").asInt()).isZero();
        mvc.perform(get("/api/tools/first")).andExpect(status().isNotFound());
        JsonNode hidden = json.readTree(mvc.perform(get("/api/tools"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("data");
        assertThat(hidden).hasSize(1);
        assertThat(hidden.get(0).get("slug").asText()).isEqualTo("second");
        assertThat(adminPut(base + "/status", "{\"status\":1}").get("status").asInt()).isEqualTo(1);
        mvc.perform(get("/api/tools/first")).andExpect(status().isOk());
    }

    @Test
    void newEndpointsRequireAdminAndCsrfAndValidateInput() throws Exception {
        jdbc.update("INSERT INTO tool (name, slug, path) VALUES (?, ?, ?)", "One", "one", "/tools/one");
        long id = jdbc.queryForObject("SELECT id FROM tool WHERE slug = 'one'", Long.class);
        String base = "/api/admin/tools/" + id;
        mvc.perform(get("/api/admin/dashboard/stats")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/dashboard/stats").with(user("reader").roles("USER")))
                .andExpect(status().isForbidden());
        for (String endpoint : new String[]{"status", "sort"}) {
            String path = base + "/" + endpoint;
            String body = endpoint.equals("status") ? "{\"status\":0}" : "{\"sortOrder\":0}";
            mvc.perform(put(path).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isUnauthorized());
            mvc.perform(put(path).with(user("reader").roles("USER")).with(csrf())
                            .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isForbidden());
            mvc.perform(put(path).with(user("admin").roles("ADMIN"))
                            .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isForbidden());
            mvc.perform(put(path).with(user("admin").roles("ADMIN")).with(csrf())
                            .contentType(MediaType.APPLICATION_JSON).content("{}"))
                    .andExpect(status().isBadRequest());
        }
        mvc.perform(put(base + "/status").with(user("admin").roles("ADMIN")).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":2}"))
                .andExpect(status().isBadRequest());
        for (int sort : new int[]{-1, 1000001}) {
            mvc.perform(put(base + "/sort").with(user("admin").roles("ADMIN")).with(csrf())
                            .contentType(MediaType.APPLICATION_JSON).content("{\"sortOrder\":" + sort + "}"))
                    .andExpect(status().isBadRequest());
        }
        mvc.perform(put("/api/admin/tools/999999/status").with(user("admin").roles("ADMIN"))
                        .with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"status\":0}"))
                .andExpect(status().isNotFound());
        mvc.perform(put("/api/admin/tools/999999/sort").with(user("admin").roles("ADMIN"))
                        .with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"sortOrder\":0}"))
                .andExpect(status().isNotFound());
    }
}
