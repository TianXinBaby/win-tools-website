package com.xiaoc.backend.dto;

import jakarta.validation.constraints.*;

public record AdminToolSaveRequest(
        @NotBlank @Size(max = 100) String name,
        @NotBlank @Size(max = 100) @Pattern(regexp = "[a-z0-9]+(?:-[a-z0-9]+)*") String slug,
        @Size(max = 255) String icon,
        @Size(max = 10000) String description,
        @Size(max = 100) String category,
        @NotBlank @Size(max = 255) @Pattern(regexp = "/tools/[a-z0-9]+(?:-[a-z0-9]+)*(?:/[a-z0-9]+(?:-[a-z0-9]+)*)*") String path,
        @NotNull @Min(0) @Max(1) Integer status,
        @NotNull @Min(0) @Max(1000000) Integer sortOrder) {
}
