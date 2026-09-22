package com.xiaoc.backend.controller;

import com.xiaoc.backend.common.ApiResponse;
import com.xiaoc.backend.dto.AdminToolSaveRequest;
import com.xiaoc.backend.service.AdminToolService;
import com.xiaoc.backend.vo.AdminToolVO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/tools")
@RequiredArgsConstructor
public class AdminToolController {

    private final AdminToolService service;

    @GetMapping
    public ApiResponse<List<AdminToolVO>> list() {
        return ApiResponse.success(service.list());
    }

    @GetMapping("/{id}")
    public ApiResponse<AdminToolVO> detail(@PathVariable long id) {
        return ApiResponse.success(service.detail(id));
    }

    @PostMapping
    public ApiResponse<AdminToolVO> create(@Valid @RequestBody AdminToolSaveRequest request) {
        return ApiResponse.success(service.create(request));
    }

    @PutMapping("/{id}")
    public ApiResponse<AdminToolVO> update(@PathVariable long id,
                                          @Valid @RequestBody AdminToolSaveRequest request) {
        return ApiResponse.success(service.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable long id) {
        service.delete(id);
        return ApiResponse.success(null);
    }
}
