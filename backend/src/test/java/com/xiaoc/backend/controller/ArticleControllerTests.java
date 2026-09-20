package com.xiaoc.backend.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class ArticleControllerTests {

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void emptyListReturnsSuccessAndAnArray() throws Exception {
        mockMvc.perform(get("/api/articles"))
                .andExpect(status().isOk())
                .andExpect(content().json("{\"code\":200,\"message\":\"success\",\"data\":[]}"));
    }

    @Test
    @Sql("/sql/content-query-data.sql")
    void listReturnsOnlyPublishedRowsInStableOrderWithoutContentOrInternalFields() throws Exception {
        String body = mockMvc.perform(get("/api/articles"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.message").value("success"))
                .andExpect(jsonPath("$.data[*].id").value(contains(301, 304, 303, 302)))
                .andExpect(jsonPath("$.data[1].viewCount").value(4294967295L))
                .andExpect(jsonPath("$.data[1].createdAt").value("2024-06-01T12:00:00"))
                .andReturn().getResponse().getContentAsString();
        for (JsonNode row : objectMapper.readTree(body).get("data")) {
            assertThat(fieldNames(row)).containsExactlyInAnyOrder(
                    "id", "title", "slug", "summary", "coverImage", "category", "viewCount", "createdAt");
        }
        assertThat(body).doesNotContain("Private", "Public body", "Tie body", "Old body");
    }

    @Test
    @Sql("/sql/content-query-data.sql")
    void publishedDetailIncludesContentAndDoesNotIncrementViewCount() throws Exception {
        var before = jdbc.queryForMap("SELECT * FROM article WHERE id = 304");
        for (int i = 0; i < 2; i++) {
            String body = mockMvc.perform(get("/api/articles/304"))
                    .andExpect(status().isOk())
                    .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                    .andExpect(content().json("""
                            {"code":200,"message":"success","data":{
                              "id":304,"title":"Article query test","slug":"query-article",
                              "summary":"Public summary","content":"Public body","coverImage":"/images/article.png",
                              "category":"tutorial","viewCount":4294967295,
                              "createdAt":"2024-06-01T12:00:00","updatedAt":"2024-06-02T13:00:00"}}
                            """))
                    .andReturn().getResponse().getContentAsString();
            assertThat(fieldNames(objectMapper.readTree(body).get("data"))).containsExactlyInAnyOrder(
                    "id", "title", "slug", "summary", "content", "coverImage", "category", "viewCount",
                    "createdAt", "updatedAt");
        }
        assertThat(jdbc.queryForMap("SELECT * FROM article WHERE id = 304")).isEqualTo(before);
    }

    @Test
    @Sql("/sql/content-query-data.sql")
    void optionalMetadataIsSerializedAsNull() throws Exception {
        String body = mockMvc.perform(get("/api/articles/301"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        JsonNode data = objectMapper.readTree(body).get("data");
        for (String field : List.of("summary", "content", "coverImage", "category")) {
            assertThat(data.has(field)).isTrue();
            assertThat(data.get(field).isNull()).isTrue();
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"0", "-1", "-9223372036854775808", "999999", "9223372036854775807", "305", "306"})
    @Sql("/sql/content-query-data.sql")
    void unavailableIdsReturnTheSameSafe404(String id) throws Exception {
        String body = mockMvc.perform(get("/api/articles/{id}", id))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andReturn().getResponse().getContentAsString();
        assertSafeError(body, 404, "Article resource not found");
    }

    @ParameterizedTest
    @ValueSource(strings = {"abc", "1.5", "9223372036854775808", "-9223372036854775809", "1 OR 1=1"})
    void invalidLongParametersReturnSafe400(String id) throws Exception {
        String body = mockMvc.perform(get("/api/articles/{id}", id))
                .andExpect(status().isBadRequest()).andReturn().getResponse().getContentAsString();
        assertSafeError(body, 400, "Bad Request");
    }

    @ParameterizedTest
    @ValueSource(strings = {"POST", "PUT", "PATCH", "DELETE"})
    void writeMethodsRemainUnavailable(String method) throws Exception {
        for (String path : List.of("/api/articles", "/api/articles/304")) {
            String body = mockMvc.perform(request(HttpMethod.valueOf(method), path))
                    .andExpect(status().isMethodNotAllowed()).andExpect(header().exists("Allow"))
                    .andReturn().getResponse().getContentAsString();
            assertSafeError(body, 405, "Method Not Allowed");
        }
    }

    private List<String> fieldNames(JsonNode node) {
        List<String> names = new ArrayList<>();
        node.fieldNames().forEachRemaining(names::add);
        return names;
    }

    private void assertSafeError(String body, int code, String message) throws Exception {
        var expected = objectMapper.createObjectNode();
        expected.put("code", code);
        expected.put("message", message);
        expected.putNull("data");
        assertThat(objectMapper.readTree(body)).isEqualTo(expected);
    }
}
