package com.xiaoc.backend.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class AdminContentControllerTests {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;

    private ObjectNode payload(String resource) {
        ObjectNode body = json.createObjectNode().put("status", 1);
        switch (resource) {
            case "windows" -> body.put("name", "Windows test").put("version", "test")
                    .put("edition", "Pro").put("architecture", "x64").put("sortOrder", 0)
                    .put("releaseDate", "2026-01-01")
                    .put("officialDownloadUrl", "https://www.microsoft.com/software-download/");
            case "tools" -> body.put("name", "Tool test").put("slug", "test-tool")
                    .put("path", "/tools/json").put("sortOrder", 0);
            case "articles" -> body.put("title", "Article test").put("slug", "test-article")
                    .put("summary", "Summary").put("content", "<script>alert('text only')</script>");
            default -> throw new IllegalArgumentException(resource);
        }
        return body;
    }

    private ResultActions admin(MockHttpServletRequestBuilder request) throws Exception {
        return mvc.perform(request.with(user("test-admin").roles("ADMIN")).with(csrf()));
    }

    private MockHttpServletRequestBuilder write(String method, String path, ObjectNode body) throws Exception {
        return request(HttpMethod.valueOf(method), path).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(body));
    }

    private JsonNode data(ResultActions result) throws Exception {
        return json.readTree(result.andExpect(status().isOk()).andExpect(jsonPath("$.code").value(200))
                .andReturn().getResponse().getContentAsString()).get("data");
    }

    private JsonNode create(String resource, ObjectNode body) throws Exception {
        return data(admin(write("POST", "/api/admin/" + resource, body)));
    }

    private String publicDetail(String resource, JsonNode row) {
        return "/api/" + resource + "/" + (resource.equals("tools") ? row.get("slug").asText() : row.get("id").asText());
    }

    @ParameterizedTest
    @ValueSource(strings = {"windows", "tools", "articles"})
    void crudIncludesHiddenRowsAndImmediatelyChangesPublicVisibility(String resource) throws Exception {
        String base = "/api/admin/" + resource;
        ObjectNode body = payload(resource).put("status", 0);
        JsonNode row = create(resource, body);
        String path = base + "/" + row.get("id").asLong();
        assertThat(row.get("createdAt").isTextual()).isTrue();
        assertThat(row.get("updatedAt").isTextual()).isTrue();
        assertThat(data(admin(get(base))).get(0)).isEqualTo(row);
        assertThat(data(admin(get(path)))).isEqualTo(row);
        mvc.perform(get(publicDetail(resource, row))).andExpect(status().isNotFound());
        assertThat(data(mvc.perform(get("/api/" + resource)))).isEmpty();

        body.put("status", 1);
        JsonNode published = data(admin(write("PUT", path, body)));
        mvc.perform(get(publicDetail(resource, row))).andExpect(status().isOk());
        assertThat(data(mvc.perform(get("/api/" + resource)))).hasSize(1);
        assertThat(published.get("status").asInt()).isEqualTo(1);

        body.put("status", 0);
        data(admin(write("PUT", path, body)));
        assertThat(data(mvc.perform(get("/api/" + resource)))).isEmpty();
        mvc.perform(get(publicDetail(resource, row))).andExpect(status().isNotFound());
        body.put("status", 1);
        data(admin(write("PUT", path, body)));
        admin(delete(path)).andExpect(status().isOk()).andExpect(jsonPath("$.data").isEmpty());
        admin(get(path)).andExpect(status().isNotFound());
        mvc.perform(get(publicDetail(resource, row))).andExpect(status().isNotFound());
        assertThat(data(mvc.perform(get("/api/" + resource)))).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = {"windows", "tools", "articles"})
    void everyEndpointRequiresAdminAndEveryWriteRequiresCsrf(String resource) throws Exception {
        String base = "/api/admin/" + resource;
        for (String method : new String[]{"GET", "POST", "PUT", "DELETE"}) {
            String path = base + (method.equals("PUT") || method.equals("DELETE") ? "/1" : "");
            mvc.perform(write(method, path, payload(resource)).with(csrf()))
                    .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value(401));
            mvc.perform(write(method, path, payload(resource)).with(csrf()).with(user("reader").roles("USER")))
                    .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value(403));
            if (!method.equals("GET")) {
                mvc.perform(write(method, path, payload(resource)).with(user("admin").roles("ADMIN")))
                        .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value(403));
                mvc.perform(write(method, path, payload(resource)).with(csrf().useInvalidToken())
                                .with(user("admin").roles("ADMIN")))
                        .andExpect(status().isForbidden());
                mvc.perform(write(method, path, payload(resource))).andExpect(status().isForbidden());
            }
        }
        mvc.perform(get(base + "/1")).andExpect(status().isUnauthorized());
        mvc.perform(get(base + "/1").with(user("reader").roles("USER"))).andExpect(status().isForbidden());
    }

    @ParameterizedTest
    @ValueSource(strings = {"windows", "tools", "articles"})
    void missingReadUpdateDeleteAre404(String resource) throws Exception {
        String path = "/api/admin/" + resource + "/999999";
        admin(get(path)).andExpect(status().isNotFound());
        admin(write("PUT", path, payload(resource))).andExpect(status().isNotFound());
        admin(delete(path)).andExpect(status().isNotFound());
        admin(get("/api/admin/" + resource + "/abc")).andExpect(status().isBadRequest());
    }

    @ParameterizedTest
    @CsvSource({"windows,name", "windows,version", "windows,edition", "windows,architecture",
            "tools,name", "tools,slug", "tools,path", "articles,title", "articles,slug"})
    void requiredFieldsAreValidatedOnCreateAndUpdate(String resource, String field) throws Exception {
        JsonNode row = create(resource, payload(resource));
        for (String value : new String[]{"", "   ", "x".repeat(1001)}) {
            assertInvalid(resource, row, payload(resource).put(field, value));
        }
        assertInvalid(resource, row, payload(resource).putNull(field));
    }

    private void assertInvalid(String resource, JsonNode row, ObjectNode body) throws Exception {
        String base = "/api/admin/" + resource;
        for (String method : new String[]{"POST", "PUT"}) {
            String path = method.equals("POST") ? base : base + "/" + row.get("id").asLong();
            admin(write(method, path, body)).andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value(400)).andExpect(jsonPath("$.data").isEmpty());
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"windows", "tools", "articles"})
    void invalidStatusAndOptionalFieldLengths(String resource) throws Exception {
        JsonNode row = create(resource, payload(resource));
        for (int value : new int[]{-1, 2, 99}) assertInvalid(resource, row, payload(resource).put("status", value));
        assertInvalid(resource, row, payload(resource).putNull("status"));
        if (!resource.equals("articles")) {
            assertInvalid(resource, row, payload(resource).put("sortOrder", -1));
            assertInvalid(resource, row, payload(resource).put("sortOrder", 1000001));
            assertInvalid(resource, row, payload(resource).putNull("sortOrder"));
        }
        String field = resource.equals("articles") ? "summary" : "description";
        assertInvalid(resource, row, payload(resource).put(field, "x".repeat(10001)));
    }

    @ParameterizedTest
    @ValueSource(strings = {"http://microsoft.com/a", "https://microsoft.com.evil.example/a",
            "https://evil-microsoft.com/a", "https://microsoft.com@evil.example/a",
            "https://evil.example@microsoft.com/a", "https://microsoft.com:444/a",
            "//microsoft.com/a", "javascript:alert(1)", "https://microsoft.com\\@evil.example",
            "https://microsoft.com./a", "https://example.com/iso", " "})
    void rejectsUnofficialDownloadUrls(String url) throws Exception {
        JsonNode row = create("windows", payload("windows"));
        assertInvalid("windows", row, payload("windows").put("officialDownloadUrl", url));
    }

    @ParameterizedTest
    @ValueSource(strings = {"https://microsoft.com", "https://www.microsoft.com/a?x=1",
            "https://download.microsoft.com/a", "HTTPS://WWW.MICROSOFT.COM:443/a", ""})
    void allowsOfficialHttpsUrls(String url) throws Exception {
        create("windows", payload("windows").put("officialDownloadUrl", url));
    }

    @ParameterizedTest
    @ValueSource(strings = {"tools", "articles"})
    void slugConflictAllowsOwnSlugAndRejectsAnotherOnCreateAndUpdate(String resource) throws Exception {
        ObjectNode body = payload(resource);
        JsonNode first = create(resource, body);
        admin(write("POST", "/api/admin/" + resource, body)).andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(resource.equals("tools")
                        ? "Tool slug already exists" : "Article slug already exists"));
        data(admin(write("PUT", "/api/admin/" + resource + "/" + first.get("id").asLong(), body)));
        JsonNode second = create(resource, payload(resource).put("slug", "another-slug"));
        admin(write("PUT", "/api/admin/" + resource + "/" + second.get("id").asLong(), body))
                .andExpect(status().isConflict());
    }

    @ParameterizedTest
    @ValueSource(strings = {"UPPER", "has space", "../escape", "/path", "a..b", "-leading", "trailing-", "你好"})
    void rejectsInvalidSlugs(String slug) throws Exception {
        for (String resource : new String[]{"tools", "articles"}) {
            JsonNode row = create(resource, payload(resource));
            assertInvalid(resource, row, payload(resource).put("slug", slug));
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"https://example.com", "http://example.com", "javascript:alert(1)",
            "/tools/../admin", "/tools/%2e%2e", "//tools/json", "/tools/", "/admin", "/tools/json?x=1"})
    void rejectsUnsafeToolPaths(String path) throws Exception {
        JsonNode row = create("tools", payload("tools"));
        assertInvalid("tools", row, payload("tools").put("path", path));
    }

    @Test
    void articleLimitsAndReadOnlyViewCount() throws Exception {
        ObjectNode body = payload("articles").put("viewCount", 99).put("content", "中".repeat(100000));
        JsonNode row = create("articles", body);
        assertThat(row.get("viewCount").asLong()).isZero();
        assertThat(row.get("content").asText()).hasSize(100000);
        long id = row.get("id").asLong();
        jdbc.update("UPDATE article SET view_count = ? WHERE id = ?", 4294967295L, id);
        body.put("viewCount", 0).put("content", "<img src=x onerror=alert(1)>");
        JsonNode updated = data(admin(write("PUT", "/api/admin/articles/" + id, body)));
        assertThat(updated.get("viewCount").asLong()).isEqualTo(4294967295L);
        assertThat(updated.get("content").asText()).isEqualTo(body.get("content").asText());
        assertInvalid("articles", row, body.put("content", "x".repeat(100001)));
    }

    @ParameterizedTest
    @ValueSource(strings = {"windows", "tools", "articles"})
    void optionalFieldsCanBeClearedAndProtectedFieldsIgnored(String resource) throws Exception {
        String field = resource.equals("articles") ? "summary" : "description";
        ObjectNode body = payload(resource).put(field, "Before");
        JsonNode row = create(resource, body);
        body.putNull(field).put("createdAt", "2000-01-01T00:00:00").put("id", 999999);
        JsonNode updated = data(admin(write("PUT", "/api/admin/" + resource + "/" + row.get("id").asLong(), body)));
        assertThat(updated.get(field).isNull()).isTrue();
        assertThat(updated.get("createdAt")).isEqualTo(row.get("createdAt"));
        assertThat(updated.get("id")).isEqualTo(row.get("id"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"windows", "tools", "articles"})
    void adminListHasDeterministicOrder(String resource) throws Exception {
        ObjectNode a = payload(resource), b = payload(resource);
        if (resource.equals("articles")) {
            b.put("slug", "second");
        } else {
            a.put("sortOrder", 2);
            b.put("sortOrder", 1);
            if (resource.equals("tools")) b.put("slug", "second");
        }
        JsonNode first = create(resource, a), second = create(resource, b);
        if (resource.equals("articles")) {
            jdbc.update("UPDATE article SET created_at = ?", java.sql.Timestamp.valueOf("2026-01-01 00:00:00"));
        }
        JsonNode list = data(admin(get("/api/admin/" + resource)));
        assertThat(list.get(0).get("id")).isEqualTo(second.get("id"));
        assertThat(list.get(1).get("id")).isEqualTo(first.get("id"));
    }

    @Test
    void windowsDateHashAndImageValidation() throws Exception {
        JsonNode row = create("windows", payload("windows"));
        for (String field : new String[]{"imageUrl", "sha256", "releaseDate"}) {
            assertInvalid("windows", row, payload("windows").put(field, "invalid"));
        }
        create("windows", payload("windows").put("sha256", "a".repeat(64)).putNull("releaseDate"));
    }
}
