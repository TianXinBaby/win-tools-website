package com.xiaoc.backend.controller;

import com.xiaoc.backend.common.ApiResponse;
import com.xiaoc.backend.dto.AdminLoginRequest;
import com.xiaoc.backend.security.AdminPrincipal;
import com.xiaoc.backend.service.AdminAuthService;
import com.xiaoc.backend.vo.AdminCsrfVO;
import com.xiaoc.backend.vo.AdminUserVO;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/auth")
@RequiredArgsConstructor
public class AdminAuthController {

    private final AdminAuthService adminAuthService;

    @GetMapping("/csrf")
    public ApiResponse<AdminCsrfVO> csrf(CsrfToken token) {
        return ApiResponse.success(new AdminCsrfVO(token.getToken(), token.getHeaderName()));
    }

    @PostMapping("/login")
    public ApiResponse<AdminUserVO> login(@Valid @RequestBody AdminLoginRequest credentials,
                                        HttpServletRequest request, HttpServletResponse response) {
        return ApiResponse.success(adminAuthService.login(credentials, request, response));
    }

    @GetMapping("/me")
    public ApiResponse<AdminUserVO> me(@AuthenticationPrincipal AdminPrincipal principal) {
        return ApiResponse.success(principal.toVO());
    }

    @PostMapping("/logout")
    public ApiResponse<Void> logout(HttpServletRequest request, HttpServletResponse response,
                                    Authentication authentication) {
        adminAuthService.logout(request, response, authentication);
        return ApiResponse.success(null);
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ApiResponse<Void>> authenticationFailed() {
        return ResponseEntity.status(401).body(ApiResponse.error(401, "用户名或密码错误"));
    }
}
