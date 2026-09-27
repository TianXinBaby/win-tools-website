package com.xiaoc.backend.vo;

public record AdminDashboardStatsVO(
        long toolTotal,
        long toolEnabled,
        long toolDisabled,
        long articleTotal,
        long articlePublished,
        long categoryCount) {
}
