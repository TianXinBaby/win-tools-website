package com.xiaoc.backend.vo;

import java.time.LocalDate;

public record WindowsVersionDetailVO(
        Long id, String name, String version, String edition, String architecture,
        LocalDate releaseDate, String description, String officialDownloadUrl,
        String sha256, String imageUrl) {
}
