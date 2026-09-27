package com.xiaoc.backend.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record AdminToolSortRequest(@NotNull @Min(0) @Max(1000000) Integer sortOrder) {
}
