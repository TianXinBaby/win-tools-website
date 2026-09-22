package com.xiaoc.backend.vo;

import java.time.LocalDateTime;

public record AdminToolVO(
        Long id,
        String name,
        String slug,
        String icon,
        String description,
        String category,
        String path,
        Integer status,
        Integer sortOrder,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {
}
