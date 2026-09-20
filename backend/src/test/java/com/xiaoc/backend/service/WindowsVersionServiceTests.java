package com.xiaoc.backend.service;

import com.xiaoc.backend.exception.ResourceNotFoundException;
import com.xiaoc.backend.vo.WindowsVersionDetailVO;
import com.xiaoc.backend.vo.WindowsVersionListVO;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class WindowsVersionServiceTests {

    @Autowired
    private WindowsVersionService service;

    @Test
    void emptyDatabaseReturnsAnEmptyList() {
        assertThat(service.listPublicVersions()).isEmpty();
    }

    @Test
    @Sql("/sql/windows-query-data.sql")
    void listFiltersInTheDatabaseAndUsesAllThreeSortKeys() {
        var versions = service.listPublicVersions();
        assertThat(versions).extracting(WindowsVersionListVO::id)
                .containsExactly(108L, 103L, 104L, 102L, 107L, 101L);
        assertThat(versions.get(1)).isEqualTo(new WindowsVersionListVO(
                103L, "Windows query test", "test-version", "Test edition", "x64",
                LocalDate.of(2024, 1, 1), "Public description", "/images/test.png"));
    }

    @Test
    @Sql("/sql/windows-query-data.sql")
    void detailMapsEveryPublicField() {
        assertThat(service.getPublicVersion(103L)).isEqualTo(new WindowsVersionDetailVO(
                103L, "Windows query test", "test-version", "Test edition", "x64",
                LocalDate.of(2024, 1, 1), "Public description",
                "https://www.microsoft.com/software-download/windows11", "a".repeat(64), "/images/test.png"));
    }

    @Test
    @Sql("/sql/windows-query-data.sql")
    void nullableMetadataRemainsNull() {
        assertThat(service.getPublicVersion(107L)).isEqualTo(new WindowsVersionDetailVO(
                107L, "Unknown release date", "test", null, null, null, null, null, null, null));
    }

    @ParameterizedTest
    @ValueSource(longs = {0, -1, Long.MIN_VALUE, 999999, Long.MAX_VALUE, 105, 106})
    @Sql("/sql/windows-query-data.sql")
    void nonPublicOrMissingIdsHaveTheSameNotFoundError(long id) {
        assertThatThrownBy(() -> service.getPublicVersion(id))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("Windows resource not found");
    }
}
