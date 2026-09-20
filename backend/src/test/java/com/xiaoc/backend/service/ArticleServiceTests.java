package com.xiaoc.backend.service;

import com.xiaoc.backend.exception.ResourceNotFoundException;
import com.xiaoc.backend.vo.ArticleDetailVO;
import com.xiaoc.backend.vo.ArticleListVO;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class ArticleServiceTests {

    @Autowired
    private ArticleService service;
    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void emptyDatabaseReturnsAnEmptyList() {
        assertThat(service.listPublicArticles()).isEmpty();
    }

    @Test
    @Sql("/sql/content-query-data.sql")
    void listFiltersInTheDatabaseAndUsesBothSortKeys() {
        var articles = service.listPublicArticles();
        assertThat(articles).extracting(ArticleListVO::id).containsExactly(301L, 304L, 303L, 302L);
        assertThat(articles.get(1)).isEqualTo(new ArticleListVO(
                304L, "Article query test", "query-article", "Public summary", "/images/article.png",
                "tutorial", 4294967295L, LocalDateTime.of(2024, 6, 1, 12, 0)));
    }

    @Test
    @Sql("/sql/content-query-data.sql")
    void detailMapsEveryPublicFieldAndNeverWritesToTheDatabase() {
        var before = jdbc.queryForList("SELECT * FROM article ORDER BY id");
        var expected = new ArticleDetailVO(
                304L, "Article query test", "query-article", "Public summary", "Public body", "/images/article.png",
                "tutorial", 4294967295L, LocalDateTime.of(2024, 6, 1, 12, 0),
                LocalDateTime.of(2024, 6, 2, 13, 0));
        assertThat(service.getPublicArticle(304L)).isEqualTo(expected);
        assertThat(service.getPublicArticle(304L)).isEqualTo(expected);
        assertThat(jdbc.queryForList("SELECT * FROM article ORDER BY id")).isEqualTo(before);
    }

    @Test
    @Sql("/sql/content-query-data.sql")
    void nullableMetadataRemainsNull() {
        assertThat(service.getPublicArticle(301L)).isEqualTo(new ArticleDetailVO(
                301L, "Newest article", "newest-article", null, null, null, null, 0L,
                LocalDateTime.of(2025, 1, 1, 12, 0), LocalDateTime.of(2025, 1, 1, 12, 0)));
    }

    @ParameterizedTest
    @ValueSource(longs = {0, -1, Long.MIN_VALUE, 999999, Long.MAX_VALUE, 305, 306})
    @Sql("/sql/content-query-data.sql")
    void unavailableIdsHaveTheSameNotFoundError(long id) {
        assertThatThrownBy(() -> service.getPublicArticle(id))
                .isInstanceOf(ResourceNotFoundException.class).hasMessage("Article resource not found");
    }
}
