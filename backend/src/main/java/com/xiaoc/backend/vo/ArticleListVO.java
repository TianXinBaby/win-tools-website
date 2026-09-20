package com.xiaoc.backend.vo;

import java.time.LocalDateTime;

public record ArticleListVO(
        Long id, String title, String slug, String summary, String coverImage,
        String category, Long viewCount, LocalDateTime createdAt) {
}
