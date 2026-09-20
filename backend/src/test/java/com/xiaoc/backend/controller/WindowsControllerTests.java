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
@Sql("/sql/windows-query-data.sql")
class WindowsControllerTests {

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void listReturnsOnlyPublicRowsInStableOrderAndOnlyListFields() throws Exception {
        String body = mockMvc.perform(get("/api/windows"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.message").value("success"))
                .andExpect(jsonPath("$.data[*].id").value(contains(108, 103, 104, 102, 107, 101)))
                .andExpect(jsonPath("$.data[1].name").value("Windows query test"))
                .andExpect(jsonPath("$.data[1].releaseDate").value("2024-01-01"))
                .andReturn().getResponse().getContentAsString();
        for (JsonNode row : objectMapper.readTree(body).get("data")) {
            assertThat(fieldNames(row)).containsExactlyInAnyOrder(
                    "id", "name", "version", "edition", "architecture", "releaseDate", "description", "imageUrl");
        }
        assertThat(body).doesNotContain("Private description", "private resource");
    }

    @Test
    void enabledDetailReturnsExactPublicFields() throws Exception {
        String body = mockMvc.perform(get("/api/windows/103"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.message").value("success"))
                .andExpect(jsonPath("$.data.id").value(103))
                .andExpect(jsonPath("$.data.name").value("Windows query test"))
                .andExpect(jsonPath("$.data.version").value("test-version"))
                .andExpect(jsonPath("$.data.edition").value("Test edition"))
                .andExpect(jsonPath("$.data.architecture").value("x64"))
                .andExpect(jsonPath("$.data.releaseDate").value("2024-01-01"))
                .andExpect(jsonPath("$.data.description").value("Public description"))
                .andExpect(jsonPath("$.data.officialDownloadUrl")
                        .value("https://www.microsoft.com/software-download/windows11"))
                .andExpect(jsonPath("$.data.sha256").value("a".repeat(64)))
                .andExpect(jsonPath("$.data.imageUrl").value("/images/test.png"))
                .andReturn().getResponse().getContentAsString();
        assertThat(fieldNames(objectMapper.readTree(body).get("data"))).containsExactlyInAnyOrder(
                "id", "name", "version", "edition", "architecture", "releaseDate", "description",
                "officialDownloadUrl", "sha256", "imageUrl");
    }

    @Test
    void unknownOptionalMetadataIsSerializedAsNull() throws Exception {
        String body = mockMvc.perform(get("/api/windows/107"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        JsonNode data = objectMapper.readTree(body).get("data");
        for (String field : List.of("edition", "architecture", "releaseDate", "description",
                "officialDownloadUrl", "sha256", "imageUrl")) {
            assertThat(data.has(field)).isTrue();
            assertThat(data.get(field).isNull()).isTrue();
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"0", "-1", "-9223372036854775808", "999999", "9223372036854775807", "105", "106"})
    void unavailableIdsReturnTheSameSafe404(String id) throws Exception {
        String body = mockMvc.perform(get("/api/windows/{id}", id))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andReturn().getResponse().getContentAsString();
        assertSafeError(body, 404, "Windows resource not found");
    }

    @ParameterizedTest
    @ValueSource(strings = {"abc", "1.5", "9223372036854775808", "-9223372036854775809", "1 OR 1=1"})
    void invalidLongParametersReturnSafe400(String id) throws Exception {
        String body = mockMvc.perform(get("/api/windows/{id}", id))
                .andExpect(status().isBadRequest())
                .andReturn().getResponse().getContentAsString();
        assertSafeError(body, 400, "Bad Request");
    }

    @ParameterizedTest
    @ValueSource(strings = {"POST", "PUT", "PATCH", "DELETE"})
    void writeMethodsRemainUnavailable(String method) throws Exception {
        for (String path : List.of("/api/windows", "/api/windows/103")) {
            String body = mockMvc.perform(request(HttpMethod.valueOf(method), path))
                    .andExpect(status().isMethodNotAllowed())
                    .andExpect(header().exists("Allow"))
                    .andReturn().getResponse().getContentAsString();
            assertSafeError(body, 405, "Method Not Allowed");
        }
    }

    private void assertSafeError(String body, int code, String message) throws Exception {
        var expected = objectMapper.createObjectNode();
        expected.put("code", code);
        expected.put("message", message);
        expected.putNull("data");
        assertThat(objectMapper.readTree(body)).isEqualTo(expected);
        assertThat(body).doesNotContain("Exception", "java.", "com.xiaoc.backend.mapper", "SQL",
                "stacktrace", "jdbc:", "password", "Private description", "private resource");
    }

    private List<String> fieldNames(JsonNode node) {
        List<String> names = new ArrayList<>();
        node.fieldNames().forEachRemaining(names::add);
        return names;
    }
}
