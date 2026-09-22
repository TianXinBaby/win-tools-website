package com.xiaoc.backend.controller;

import com.xiaoc.backend.common.ApiResponse;
import com.xiaoc.backend.dto.AdminArticleSaveRequest;
import com.xiaoc.backend.service.AdminArticleService;
import com.xiaoc.backend.vo.AdminArticleVO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/articles")
@RequiredArgsConstructor
public class AdminArticleController {

    private final AdminArticleService service;

    @GetMapping
    public ApiResponse<List<AdminArticleVO>> list() {
        return ApiResponse.success(service.list());
    }

    @GetMapping("/{id}")
    public ApiResponse<AdminArticleVO> detail(@PathVariable long id) {
        return ApiResponse.success(service.detail(id));
    }

    @PostMapping
    public ApiResponse<AdminArticleVO> create(@Valid @RequestBody AdminArticleSaveRequest request) {
        return ApiResponse.success(service.create(request));
    }

    @PutMapping("/{id}")
    public ApiResponse<AdminArticleVO> update(@PathVariable long id,
                                          @Valid @RequestBody AdminArticleSaveRequest request) {
        return ApiResponse.success(service.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable long id) {
        service.delete(id);
        return ApiResponse.success(null);
    }
}
