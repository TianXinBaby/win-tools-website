package com.xiaoc.backend.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record AdminToolStatusRequest(@NotNull @Min(0) @Max(1) Integer status) {
}
