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
class ToolControllerTests {

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void emptyListReturnsSuccessAndAnArray() throws Exception {
        mockMvc.perform(get("/api/tools"))
                .andExpect(status().isOk())
                .andExpect(content().json("{\"code\":200,\"message\":\"success\",\"data\":[]}"));
    }

    @Test
    @Sql("/sql/content-query-data.sql")
    void listReturnsOnlyEnabledRowsInStableOrderAndOnlyPublicFields() throws Exception {
        String body = mockMvc.perform(get("/api/tools"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.message").value("success"))
                .andExpect(jsonPath("$.data[*].id").value(contains(206, 202, 203, 201)))
                .andReturn().getResponse().getContentAsString();
        for (JsonNode row : objectMapper.readTree(body).get("data")) {
            assertPublicFields(row);
        }
        assertThat(body).doesNotContain("Private", "disabled-tool", "unknown-status");
    }

    @Test
    @Sql("/sql/content-query-data.sql")
    void enabledDetailReturnsExactPublicFields() throws Exception {
        String body = mockMvc.perform(get("/api/tools/json-test"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(content().json("""
                        {"code":200,"message":"success","data":{
                          "id":202,"name":"JSON test","slug":"json-test","icon":"code",
                          "description":"Public description","category":"developer","path":"/tools/json-test"}}
                        """))
                .andReturn().getResponse().getContentAsString();
        assertPublicFields(objectMapper.readTree(body).get("data"));
    }

    @Test
    @Sql("/sql/content-query-data.sql")
    void optionalMetadataIsSerializedAsNull() throws Exception {
        String body = mockMvc.perform(get("/api/tools/first-tool"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        JsonNode data = objectMapper.readTree(body).get("data");
        assertPublicFields(data);
        for (String field : List.of("icon", "description", "category")) {
            assertThat(data.get(field).isNull()).isTrue();
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"missing", "disabled-tool", "unknown-status", "json", " ", "%", "' OR 1=1 --"})
    @Sql("/sql/content-query-data.sql")
    void unavailableSlugsReturnTheSameSafe404(String slug) throws Exception {
        String body = mockMvc.perform(get("/api/tools/{slug}", slug))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andReturn().getResponse().getContentAsString();
        assertSafeError(body, 404, "Tool resource not found");
    }

    @Test
    @Sql("/sql/content-query-data.sql")
    void oversizedSlugReturnsSafe404() throws Exception {
        String body = mockMvc.perform(get("/api/tools/{slug}", "x".repeat(101)))
                .andExpect(status().isNotFound()).andReturn().getResponse().getContentAsString();
        assertSafeError(body, 404, "Tool resource not found");
    }

    @ParameterizedTest
    @ValueSource(strings = {"POST", "PUT", "PATCH", "DELETE"})
    void writeMethodsRemainUnavailable(String method) throws Exception {
        for (String path : List.of("/api/tools", "/api/tools/json-test")) {
            String body = mockMvc.perform(request(HttpMethod.valueOf(method), path))
                    .andExpect(status().isMethodNotAllowed()).andExpect(header().exists("Allow"))
                    .andReturn().getResponse().getContentAsString();
            assertSafeError(body, 405, "Method Not Allowed");
        }
    }

    private void assertPublicFields(JsonNode node) {
        List<String> names = new ArrayList<>();
        node.fieldNames().forEachRemaining(names::add);
        assertThat(names).containsExactlyInAnyOrder("id", "name", "slug", "icon", "description", "category", "path");
    }

    private void assertSafeError(String body, int code, String message) throws Exception {
        var expected = objectMapper.createObjectNode();
        expected.put("code", code);
        expected.put("message", message);
        expected.putNull("data");
        assertThat(objectMapper.readTree(body)).isEqualTo(expected);
    }
}
