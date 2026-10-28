package com.xiaoc.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.ActiveProfiles;

import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import static org.assertj.core.api.Assertions.assertThat;

/** Real Servlet multipart parsing: MockMvc multipart bypasses the container size limit. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "server.address=127.0.0.1", "win-tools.video-converter.enabled=false",
        "spring.servlet.multipart.max-file-size=8B", "spring.servlet.multipart.max-request-size=1024B"
})
@ActiveProfiles("test")
class VideoConverterUploadLimitTests {
    @LocalServerPort int port;
    @Autowired ObjectMapper mapper;

    @Test void servletRejectsAnOversizedFileBeforeSubmission() throws Exception {
        assertRejected("123456789", "mp4");
    }

    @Test void servletRejectsAnOversizedMultipartRequestBeforeSubmission() throws Exception {
        assertRejected("1", "x".repeat(2048));
    }

    private void assertRejected(String file, String target) throws Exception {
        var client = HttpClient.newBuilder()
                .cookieHandler(new CookieManager(null, CookiePolicy.ACCEPT_ALL)).build();
        String base = "http://127.0.0.1:" + port;
        var csrfResponse = client.send(HttpRequest.newBuilder(URI.create(base + "/api/admin/auth/csrf"))
                .GET().build(), HttpResponse.BodyHandlers.ofString());
        assertThat(csrfResponse.statusCode()).isEqualTo(200);
        var csrf = mapper.readTree(csrfResponse.body()).path("data");
        String boundary = "r1-upload-boundary";
        String body = "--" + boundary + "\r\nContent-Disposition: form-data; name=\"targetFormat\"\r\n\r\n"
                + target + "\r\n--" + boundary
                + "\r\nContent-Disposition: form-data; name=\"file\"; filename=\"source.asf\""
                + "\r\nContent-Type: video/x-ms-asf\r\n\r\n" + file + "\r\n--" + boundary + "--\r\n";
        var response = client.send(HttpRequest.newBuilder(URI.create(base + "/api/tools/video-converter/jobs"))
                .header(csrf.path("headerName").asText(), csrf.path("token").asText())
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .POST(HttpRequest.BodyPublishers.ofString(body)).build(), HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).as(response.body()).isEqualTo(413);
        assertThat(mapper.readTree(response.body()).path("message").asText()).isEqualTo("VIDEO_TOO_LARGE");
        assertThat(response.body()).doesNotContain("Exception", "session", "target/", "source.asf");
    }
}
