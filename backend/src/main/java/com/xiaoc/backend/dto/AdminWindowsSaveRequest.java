package com.xiaoc.backend.dto;

import jakarta.validation.constraints.*;
import com.xiaoc.backend.validation.SafeHttpsUrl;
import java.time.LocalDate;

public record AdminWindowsSaveRequest(
        @NotBlank @Size(max = 100) String name,
        @NotBlank @Size(max = 50) String version,
        @NotBlank @Size(max = 100) String edition,
        @NotBlank @Size(max = 20) String architecture,
        LocalDate releaseDate,
        @Size(max = 10000) String description,
        @Size(max = 1000) @SafeHttpsUrl(microsoftOnly = true) String officialDownloadUrl,
        @Size(max = 64) @Pattern(regexp = "(?:|[a-fA-F0-9]{64})") String sha256,
        @Size(max = 1000) @SafeHttpsUrl String imageUrl,
        @NotNull @Min(0) @Max(1) Integer status,
        @NotNull @Min(0) @Max(1000000) Integer sortOrder) {
}
