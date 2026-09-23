package com.xiaoc.backend.controller;

import jakarta.servlet.RequestDispatcher;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.assertj.core.api.Assertions.assertThat;

class ApiErrorControllerTests {

    @ParameterizedTest
    @ValueSource(ints = {400, 404, 405, 500, 503})
    void containerStatusIsPreservedWithoutExceptionDetails(int status) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setAttribute(RequestDispatcher.ERROR_STATUS_CODE, status);
        request.setAttribute(RequestDispatcher.ERROR_MESSAGE, "private database password");
        request.setAttribute(RequestDispatcher.ERROR_EXCEPTION, new RuntimeException("private SQL"));
        var response = new ApiErrorController().error(request);
        assertThat(response.getStatusCode().value()).isEqualTo(status);
        assertThat(response.getBody().code()).isEqualTo(status);
        assertThat(response.getBody().message()).doesNotContain("private", "password", "SQL");
        assertThat(response.getBody().data()).isNull();
    }
}
