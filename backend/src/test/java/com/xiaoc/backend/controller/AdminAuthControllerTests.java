package com.xiaoc.backend.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.xiaoc.backend.entity.AdminUser;
import com.xiaoc.backend.mapper.AdminUserMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class AdminAuthControllerTests {

    private static final String PASSWORD = " test-only secure passphrase ";
    private static final String HASH = new BCryptPasswordEncoder(12).encode(PASSWORD);
    private static final String ROOT = "/api/admin/auth";

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private AdminUserMapper admins;

    @BeforeEach
    void fixture() {
        insertAdmin("test-admin", HASH, 1);
        insertAdmin("disabled-admin", HASH, 0);
        insertAdmin("other-status-admin", HASH, 2);
        insertAdmin("plaintext-admin", PASSWORD, 1);
    }

    private void insertAdmin(String username, String password, int status) {
        AdminUser admin = new AdminUser();
        admin.setUsername(username);
        admin.setPassword(password);
        admin.setNickname("测试管理员");
        admin.setStatus(status);
        admins.insert(admin);
    }

    @Test
    void anonymousCsrfReturnsRealTokenAndIsNotCacheable() throws Exception {
        MvcResult result = mvc.perform(get(ROOT + "/csrf"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.data.token").isNotEmpty())
                .andExpect(jsonPath("$.data.headerName").value("X-CSRF-TOKEN"))
                .andExpect(header().string("Cache-Control", org.hamcrest.Matchers.containsString("no-store")))
                .andReturn();
        assertThat(result.getRequest().getSession(false)).isNotNull();
    }

    @Test
    void loginPersistsContextRotatesSessionAndCsrfThenLogoutReallyInvalidates() throws Exception {
        MvcResult csrfResult = mvc.perform(get(ROOT + "/csrf")).andReturn();
        MockHttpSession session = (MockHttpSession) csrfResult.getRequest().getSession(false);
        String previousId = session.getId();
        JsonNode token = data(csrfResult);
        MvcResult login = mvc.perform(post(ROOT + "/login").session(session)
                        .header(token.get("headerName").asText(), token.get("token").asText())
                        .contentType(MediaType.APPLICATION_JSON).content(credentials(" test-admin ", PASSWORD)))
                .andExpect(status().isOk()).andReturn();
        assertAdminShape(login);
        assertThat(session.getId()).isNotEqualTo(previousId);
        SecurityContext context = (SecurityContext) session.getAttribute("SPRING_SECURITY_CONTEXT");
        assertThat(context.getAuthentication().getAuthorities()).extracting("authority").containsExactly("ROLE_ADMIN");
        assertThat(((UserDetails) context.getAuthentication().getPrincipal()).getPassword()).isNull();
        assertAdminShape(mvc.perform(get(ROOT + "/me").session(session))
                .andExpect(status().isOk()).andReturn());

        // Authentication clears the previous CSRF token; fetching a fresh one is required.
        assertError(mvc.perform(post(ROOT + "/logout").session(session)
                        .header(token.get("headerName").asText(), token.get("token").asText()))
                .andExpect(status().isForbidden()).andReturn(), 403, "Forbidden");
        JsonNode fresh = data(mvc.perform(get(ROOT + "/csrf").session(session)).andReturn());
        mvc.perform(post(ROOT + "/logout").session(session)
                        .header(fresh.get("headerName").asText(), fresh.get("token").asText()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data").isEmpty());
        assertThat(session.isInvalid()).isTrue();
        assertError(mvc.perform(get(ROOT + "/me"))
                .andExpect(status().isUnauthorized()).andReturn(), 401, "Unauthorized");
    }

    @ParameterizedTest
    @ValueSource(strings = {"test-admin", "missing-admin", "disabled-admin", "other-status-admin", "plaintext-admin"})
    void allCredentialFailuresReturnIdenticalSafeJson(String username) throws Exception {
        String password = username.equals("test-admin") ? "wrong-test-password" : PASSWORD;
        assertError(mvc.perform(post(ROOT + "/login").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(credentials(username, password)))
                .andExpect(status().isUnauthorized()).andReturn(), 401, "用户名或密码错误");
    }

    @Test
    void passwordWhitespaceIsSignificant() throws Exception {
        mvc.perform(post(ROOT + "/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(credentials("test-admin", PASSWORD.trim())))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void multibyteWrongPasswordDoesNotExposeEncoderErrors() throws Exception {
        assertError(mvc.perform(post(ROOT + "/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(credentials("test-admin", "测".repeat(40))))
                .andExpect(status().isUnauthorized()).andReturn(), 401, "用户名或密码错误");
    }

    @ParameterizedTest
    @ValueSource(strings = {"/login", "/logout"})
    void missingOrInvalidCsrfReturnsJson403(String path) throws Exception {
        assertError(mvc.perform(post(ROOT + path).contentType(MediaType.APPLICATION_JSON)
                        .content(credentials("test-admin", PASSWORD)))
                .andExpect(status().isForbidden()).andReturn(), 403, "Forbidden");
        assertError(mvc.perform(post(ROOT + path).with(csrf().useInvalidToken())
                        .contentType(MediaType.APPLICATION_JSON).content(credentials("test-admin", PASSWORD)))
                .andExpect(status().isForbidden()).andReturn(), 403, "Forbidden");
    }

    @Test
    void authenticatedLogoutWithoutCsrfDoesNotLogOut() throws Exception {
        MockHttpSession session = loginSession();
        assertError(mvc.perform(post(ROOT + "/logout").session(session))
                .andExpect(status().isForbidden()).andReturn(), 403, "Forbidden");
        mvc.perform(get(ROOT + "/me").session(session)).andExpect(status().isOk());
    }

    @ParameterizedTest
    @ValueSource(strings = {"/api/admin", "/api/admin/auth/me", "/api/admin/future", "/api/admin/windows"})
    void anonymousAdminEndpointsRequireAuthentication(String path) throws Exception {
        assertError(mvc.perform(get(path)).andExpect(status().isUnauthorized()).andReturn(), 401, "Unauthorized");
    }

    @Test
    void anonymousLogoutWithCsrfStillRequiresAuthentication() throws Exception {
        assertError(mvc.perform(post(ROOT + "/logout").with(csrf()))
                .andExpect(status().isUnauthorized()).andReturn(), 401, "Unauthorized");
    }

    @Test
    void insufficientRoleReturnsJson403() throws Exception {
        assertError(mvc.perform(get(ROOT + "/me").with(user("ordinary").roles("USER")))
                .andExpect(status().isForbidden()).andReturn(), 403, "Forbidden");
    }

    @Test
    void getLogoutCannotChangeAuthentication() throws Exception {
        MockHttpSession session = loginSession();
        mvc.perform(get(ROOT + "/logout").session(session)).andExpect(status().isMethodNotAllowed());
        mvc.perform(get(ROOT + "/me").session(session)).andExpect(status().isOk());
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "{\"username\":\" \",\"password\":\"x\"}",
            "{\"username\":\"test-admin\",\"password\":\" \"}", "not json"})
    void malformedOrBlankCredentialsReturnSafe400(String body) throws Exception {
        assertError(mvc.perform(post(ROOT + "/login").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest()).andReturn(), 400, "Bad Request");
    }

    @Test
    void oversizedCredentialsReturn400() throws Exception {
        for (String body : new String[]{credentials("x".repeat(101), PASSWORD),
                credentials("test-admin", "x".repeat(73))}) {
            mvc.perform(post(ROOT + "/login").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest());
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"/api/hello", "/api/windows", "/api/tools", "/api/articles"})
    void publicApiRemainsAnonymous(String path) throws Exception {
        mvc.perform(get(path)).andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON));
    }

    @Test
    void unknownPublicUrlRemains404() throws Exception {
        assertError(mvc.perform(get("/api/unknown-public-url"))
                .andExpect(status().isNotFound()).andReturn(), 404, "Not Found");
    }

    @ParameterizedTest
    @ValueSource(strings = {"/api/admin/%25", "/api/admin/%252f/auth/me", "/api/tools/%2525"})
    void encodedAdminAndDoubleEncodedPathsRemainRejected(String path) throws Exception {
        mvc.perform(get(java.net.URI.create(path))).andExpect(status().isBadRequest());
    }

    private MockHttpSession loginSession() throws Exception {
        return (MockHttpSession) mvc.perform(post(ROOT + "/login").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(credentials("test-admin", PASSWORD)))
                .andExpect(status().isOk()).andReturn().getRequest().getSession(false);
    }

    private String credentials(String username, String password) throws Exception {
        return json.writeValueAsString(Map.of("username", username, "password", password));
    }

    private JsonNode data(MvcResult result) throws Exception {
        return json.readTree(result.getResponse().getContentAsString(StandardCharsets.UTF_8)).get("data");
    }

    private void assertAdminShape(MvcResult result) throws Exception {
        JsonNode admin = data(result);
        assertThat(admin.size()).isEqualTo(3);
        assertThat(admin.get("id").isNumber()).isTrue();
        assertThat(admin.get("username").asText()).isEqualTo("test-admin");
        assertThat(admin.get("nickname").asText()).isEqualTo("测试管理员");
    }

    private void assertError(MvcResult result, int code, String message) throws Exception {
        assertThat(result.getResponse().getContentType()).startsWith(MediaType.APPLICATION_JSON_VALUE);
        assertThat(result.getResponse().getRedirectedUrl()).isNull();
        JsonNode expected = json.valueToTree(com.xiaoc.backend.common.ApiResponse.error(code, message));
        assertThat(json.readTree(result.getResponse().getContentAsString(StandardCharsets.UTF_8))).isEqualTo(expected);
    }
}
