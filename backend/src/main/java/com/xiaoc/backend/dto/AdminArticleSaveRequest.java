package com.xiaoc.backend.dto;

import jakarta.validation.constraints.*;
import com.xiaoc.backend.validation.SafeHttpsUrl;

public record AdminArticleSaveRequest(
        @NotBlank @Size(max = 255) String title,
        @NotBlank @Size(max = 200) @Pattern(regexp = "[a-z0-9]+(?:-[a-z0-9]+)*") String slug,
        @Size(max = 1000) String summary,
        @Size(max = 100000) String content,
        @Size(max = 1000) @SafeHttpsUrl String coverImage,
        @Size(max = 100) String category,
        @NotNull @Min(0) @Max(1) Integer status) {
}
