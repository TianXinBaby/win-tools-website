package com.xiaoc.backend.controller;

import com.xiaoc.backend.common.ApiResponse;
import com.xiaoc.backend.service.WindowsVersionService;
import com.xiaoc.backend.vo.WindowsVersionDetailVO;
import com.xiaoc.backend.vo.WindowsVersionListVO;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/windows")
@RequiredArgsConstructor
public class WindowsController {

    private final WindowsVersionService windowsVersionService;

    @GetMapping
    public ApiResponse<List<WindowsVersionListVO>> list() {
        return ApiResponse.success(windowsVersionService.listPublicVersions());
    }

    @GetMapping("/{id}")
    public ApiResponse<WindowsVersionDetailVO> detail(@PathVariable long id) {
        return ApiResponse.success(windowsVersionService.getPublicVersion(id));
    }
}
