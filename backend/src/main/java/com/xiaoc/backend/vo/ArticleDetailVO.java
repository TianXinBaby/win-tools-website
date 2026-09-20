package com.xiaoc.backend.vo;

import java.time.LocalDateTime;

public record ArticleDetailVO(
        Long id, String title, String slug, String summary, String content, String coverImage,
        String category, Long viewCount, LocalDateTime createdAt, LocalDateTime updatedAt) {
}
