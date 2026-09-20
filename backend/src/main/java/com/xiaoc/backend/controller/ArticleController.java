package com.xiaoc.backend.controller;

import com.xiaoc.backend.common.ApiResponse;
import com.xiaoc.backend.service.ArticleService;
import com.xiaoc.backend.vo.ArticleDetailVO;
import com.xiaoc.backend.vo.ArticleListVO;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/articles")
@RequiredArgsConstructor
public class ArticleController {

    private final ArticleService articleService;

    @GetMapping
    public ApiResponse<List<ArticleListVO>> list() {
        return ApiResponse.success(articleService.listPublicArticles());
    }

    @GetMapping("/{id}")
    public ApiResponse<ArticleDetailVO> detail(@PathVariable long id) {
        return ApiResponse.success(articleService.getPublicArticle(id));
    }
}
