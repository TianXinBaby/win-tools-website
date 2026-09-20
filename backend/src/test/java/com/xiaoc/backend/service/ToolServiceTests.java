package com.xiaoc.backend.service;

import com.xiaoc.backend.exception.ResourceNotFoundException;
import com.xiaoc.backend.vo.ToolVO;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class ToolServiceTests {

    @Autowired
    private ToolService service;

    @Test
    void emptyDatabaseReturnsAnEmptyList() {
        assertThat(service.listPublicTools()).isEmpty();
    }

    @Test
    @Sql("/sql/content-query-data.sql")
    void listFiltersInTheDatabaseAndUsesBothSortKeys() {
        var tools = service.listPublicTools();
        assertThat(tools).extracting(ToolVO::id).containsExactly(206L, 202L, 203L, 201L);
        assertThat(tools.get(1)).isEqualTo(new ToolVO(
                202L, "JSON test", "json-test", "code", "Public description", "developer", "/tools/json-test"));
    }

    @Test
    @Sql("/sql/content-query-data.sql")
    void detailMapsEveryPublicField() {
        assertThat(service.getPublicTool("json-test")).isEqualTo(new ToolVO(
                202L, "JSON test", "json-test", "code", "Public description", "developer", "/tools/json-test"));
    }

    @Test
    @Sql("/sql/content-query-data.sql")
    void nullableMetadataRemainsNull() {
        assertThat(service.getPublicTool("first-tool")).isEqualTo(new ToolVO(
                206L, "Lower sort order", "first-tool", null, null, null, "/tools/first-tool"));
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {" ", "\t", "missing", "disabled-tool", "unknown-status", "json", "%", "' OR 1=1 --"})
    @Sql("/sql/content-query-data.sql")
    void unavailableSlugsHaveTheSameNotFoundError(String slug) {
        assertThatThrownBy(() -> service.getPublicTool(slug))
                .isInstanceOf(ResourceNotFoundException.class).hasMessage("Tool resource not found");
    }
}
