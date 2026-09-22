package com.xiaoc.backend.vo;

import java.time.LocalDateTime;
import java.time.LocalDate;

public record AdminWindowsVO(
        Long id,
        String name,
        String version,
        String edition,
        String architecture,
        LocalDate releaseDate,
        String description,
        String officialDownloadUrl,
        String sha256,
        String imageUrl,
        Integer status,
        Integer sortOrder,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {
}
