package com.xiaoc.backend.controller;

import com.xiaoc.backend.common.ApiResponse;
import com.xiaoc.backend.dto.AdminWindowsSaveRequest;
import com.xiaoc.backend.service.AdminWindowsService;
import com.xiaoc.backend.vo.AdminWindowsVO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/windows")
@RequiredArgsConstructor
public class AdminWindowsController {

    private final AdminWindowsService service;

    @GetMapping
    public ApiResponse<List<AdminWindowsVO>> list() {
        return ApiResponse.success(service.list());
    }

    @GetMapping("/{id}")
    public ApiResponse<AdminWindowsVO> detail(@PathVariable long id) {
        return ApiResponse.success(service.detail(id));
    }

    @PostMapping
    public ApiResponse<AdminWindowsVO> create(@Valid @RequestBody AdminWindowsSaveRequest request) {
        return ApiResponse.success(service.create(request));
    }

    @PutMapping("/{id}")
    public ApiResponse<AdminWindowsVO> update(@PathVariable long id,
                                          @Valid @RequestBody AdminWindowsSaveRequest request) {
        return ApiResponse.success(service.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable long id) {
        service.delete(id);
        return ApiResponse.success(null);
    }
}
