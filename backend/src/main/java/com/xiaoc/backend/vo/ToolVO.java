package com.xiaoc.backend.vo;

public record ToolVO(
        Long id, String name, String slug, String icon, String description, String category, String path) {
}
