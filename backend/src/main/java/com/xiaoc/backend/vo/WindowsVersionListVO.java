package com.xiaoc.backend.vo;

import java.time.LocalDate;

public record WindowsVersionListVO(
        Long id, String name, String version, String edition, String architecture,
        LocalDate releaseDate, String description, String imageUrl) {
}
