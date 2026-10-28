package com.xiaoc.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.xiaoc.backend.service.video.VideoTranscoder;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import java.nio.file.Files;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {"win-tools.video-converter.enabled=true", "win-tools.video-converter.temp-dir=target/video-controller-tests"})
@AutoConfigureMockMvc
@ActiveProfiles("test")
class VideoConverterControllerTests {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @MockitoBean VideoTranscoder transcoder;
    @BeforeEach void setup() {
        when(transcoder.available()).thenReturn(true);
        when(transcoder.probe(any(), any())).thenReturn(1.0);
        doAnswer(call -> { Files.write(call.getArgument(1), new byte[]{1,2,3}); return null; })
                .when(transcoder).convert(any(), any(), anyString(), anyDouble(), any(), any());
    }
    @Test void csrfAndSessionOwnershipProtectAnonymousVideoTasks() throws Exception {
        MockHttpSession session = new MockHttpSession();
        var csrf = mapper.readTree(mvc.perform(get("/api/admin/auth/csrf").session(session))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("data");
        var file = new MockMultipartFile("file", "中文 空格.asf", "video/x-ms-asf", new byte[]{1});
        String base = "/api/tools/video-converter/jobs";
        mvc.perform(multipart(base).file(file).param("targetFormat", "mp4").session(session)).andExpect(status().isForbidden());
        String body = mvc.perform(multipart(base).file(file).param("targetFormat", "mp4").session(session)
                        .header(csrf.path("headerName").asText(), csrf.path("token").asText()))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andReturn().getResponse().getContentAsString();
        String id = mapper.readTree(body).path("data").path("jobId").asText();
        boolean complete = false;
        for (int i=0; i<100; i++) {
            var result = mvc.perform(get(base + "/" + id).session(session)).andExpect(status().isOk())
                    .andReturn().getResponse().getContentAsString();
            assertThat(result).doesNotContain("target/video", "ffmpeg", "owner");
            if (mapper.readTree(result).path("data").path("status").asText().equals("COMPLETED")) { complete=true; break; }
            Thread.sleep(10);
        }
        assertThat(complete).isTrue();
        mvc.perform(get(base + "/" + id + "/download").session(session)).andExpect(status().isOk())
                .andExpect(content().bytes(new byte[]{1,2,3})).andExpect(header().string("Content-Disposition", "attachment; filename=\"converted.mp4\""));
        mvc.perform(head(base + "/" + id + "/download").session(session)).andExpect(status().isOk())
                .andExpect(header().longValue("Content-Length", 3));
        mvc.perform(get(base + "/" + id).session(new MockHttpSession())).andExpect(status().isNotFound());
        mvc.perform(get(base + "/" + id + "/download")).andExpect(status().isNotFound());
        MockHttpSession other = new MockHttpSession();
        var otherCsrf = mapper.readTree(mvc.perform(get("/api/admin/auth/csrf").session(other))
                .andReturn().getResponse().getContentAsString()).path("data");
        // A valid token authorizes the request method, but never another session's job.
        mvc.perform(delete(base + "/" + id).session(other)
                        .header(otherCsrf.path("headerName").asText(), otherCsrf.path("token").asText()))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.message").value("VIDEO_JOB_NOT_FOUND"));
        mvc.perform(get(base + "/" + id + "/download").session(other)).andExpect(status().isNotFound());
        mvc.perform(delete(base + "/" + id).session(other)
                        .header(csrf.path("headerName").asText(), csrf.path("token").asText()))
                .andExpect(status().isForbidden());
        mvc.perform(delete(base + "/" + id).session(session)).andExpect(status().isForbidden());
        mvc.perform(delete(base + "/" + id).session(session).header("X-CSRF-TOKEN", "invalid"))
                .andExpect(status().isForbidden());
        mvc.perform(delete(base + "/" + id).session(session)
                .header(csrf.path("headerName").asText(), csrf.path("token").asText())).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("CANCELLED"));
        assertThat(java.nio.file.Path.of("target/video-controller-tests/job-" + id)).doesNotExist();
        mvc.perform(get(base + "/" + id + "/download").session(session)).andExpect(status().isConflict());
        mvc.perform(get("/api/admin/tools").session(session)).andExpect(status().isUnauthorized());
    }
    @ParameterizedTest
    @ValueSource(strings = {"https://example.invalid/output.mp4", "../../output.mp4", "mp4 -i secret", "file:/tmp/out", "-y"})
    void rejectsTargetInjectionWithoutExposingInternalDetails(String target) throws Exception {
        MockHttpSession session = new MockHttpSession();
        var csrf = mapper.readTree(mvc.perform(get("/api/admin/auth/csrf").session(session))
                .andReturn().getResponse().getContentAsString()).path("data");
        mvc.perform(multipart("/api/tools/video-converter/jobs")
                        .file(new MockMultipartFile("file", "source.asf", "video/x-ms-asf", new byte[]{1}))
                        .param("targetFormat", target).session(session)
                        .header(csrf.path("headerName").asText(), csrf.path("token").asText()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("VIDEO_TARGET_UNSUPPORTED"))
                .andExpect(jsonPath("$.data").isEmpty());
    }

    @Test void invalidPostCsrfNeverCreatesATask() throws Exception {
        mvc.perform(multipart("/api/tools/video-converter/jobs")
                        .file(new MockMultipartFile("file", "source.asf", "video/x-ms-asf", new byte[]{1}))
                        .param("targetFormat", "mp4").session(new MockHttpSession())
                        .header("X-CSRF-TOKEN", "invalid"))
                .andExpect(status().isForbidden());
    }

    @Test void unexpectedTranscoderFailureReturnsOnlyAFixedPublicCode() throws Exception {
        when(transcoder.probe(any(), any())).thenThrow(
                new IllegalStateException("/srv/private/video session=secret java.lang.Exception"));
        MockHttpSession session = new MockHttpSession();
        var csrf = mapper.readTree(mvc.perform(get("/api/admin/auth/csrf").session(session))
                .andReturn().getResponse().getContentAsString()).path("data");
        String body = mvc.perform(multipart("/api/tools/video-converter/jobs")
                        .file(new MockMultipartFile("file", "source.asf", "video/x-ms-asf", new byte[]{1}))
                        .param("targetFormat", "mp4").session(session)
                        .header(csrf.path("headerName").asText(), csrf.path("token").asText()))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String id = mapper.readTree(body).path("data").path("jobId").asText();
        String result = "";
        for (int i = 0; i < 100; i++) {
            result = mvc.perform(get("/api/tools/video-converter/jobs/" + id).session(session))
                    .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
            if (mapper.readTree(result).path("data").path("status").asText().equals("FAILED")) break;
            Thread.sleep(10);
        }
        assertThat(mapper.readTree(result).path("data").path("errorCode").asText())
                .isEqualTo("VIDEO_CONVERSION_FAILED");
        assertThat(result).doesNotContain("/srv/", "secret", "java.lang", "session=");
    }
    @Test void capabilitiesArePublicAndNotCacheable() throws Exception {
        mvc.perform(get("/api/tools/video-converter/capabilities"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.available").value(true))
                .andExpect(jsonPath("$.data.inputFormats[0]").value("asf"))
                .andExpect(jsonPath("$.data.maxUploadBytes").value(524288000L))
                .andExpect(header().string("Cache-Control", "no-store"));
    }
}
