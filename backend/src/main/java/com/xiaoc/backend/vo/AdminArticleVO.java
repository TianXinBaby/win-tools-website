package com.xiaoc.backend.vo;

import java.time.LocalDateTime;

public record AdminArticleVO(
        Long id,
        String title,
        String slug,
        String summary,
        String content,
        String coverImage,
        String category,
        Integer status,
        Long viewCount,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {
}
