package com.xiaoc.backend.controller;

import com.xiaoc.backend.common.ApiResponse;
import com.xiaoc.backend.service.ToolService;
import com.xiaoc.backend.vo.ToolVO;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/tools")
@RequiredArgsConstructor
public class ToolController {

    private final ToolService toolService;

    @GetMapping
    public ApiResponse<List<ToolVO>> list() {
        return ApiResponse.success(toolService.listPublicTools());
    }

    @GetMapping("/{slug}")
    public ApiResponse<ToolVO> detail(@PathVariable String slug) {
        return ApiResponse.success(toolService.getPublicTool(slug));
    }
}
