package com.xiaoc.backend.mapper;

import com.xiaoc.backend.service.ArticleService;
import com.xiaoc.backend.service.ToolService;
import com.xiaoc.backend.vo.ArticleListVO;
import com.xiaoc.backend.vo.ToolVO;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.FileSystemResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import javax.sql.DataSource;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class ContentDevSeedTests {

    @Autowired
    private DataSource dataSource;
    @Autowired
    private JdbcTemplate jdbc;
    @Autowired
    private ToolService toolService;
    @Autowired
    private ArticleService articleService;

    @Test
    void seedCanBeRepeatedAndProvidesPublicExamplesWithoutAdminAccounts() {
        seed();
        seed();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM tool", Long.class)).isEqualTo(9L);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM article", Long.class)).isEqualTo(3L);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM admin_user", Long.class)).isZero();
        var tools = toolService.listPublicTools();
        assertThat(tools).extracting(ToolVO::slug).containsExactly("json", "uuid", "timestamp", "sha256", "base64",
                "qrcode", "image-compress", "image-resize", "image-convert");
        assertThat(tools).allSatisfy(tool -> {
            assertThat(tool.path()).isEqualTo("/tools/" + tool.slug());
            if (tool.category().equals("media")) {
                assertThat(tool.description()).contains("本地");
            } else {
                assertThat(tool.description()).contains("当前阶段未实现工具功能");
            }
            assertThat(toolService.getPublicTool(tool.slug())).isEqualTo(tool);
        });
        var articles = articleService.listPublicArticles();
        assertThat(articles).extracting(ArticleListVO::slug).containsExactlyInAnyOrder(
                "windows-11-download-guide", "windows-10-download-guide", "online-tools-guide");
        assertThat(articles).allSatisfy(article -> {
            assertThat(article.viewCount()).isZero();
            assertThat(articleService.getPublicArticle(article.id()).content()).isNotBlank();
        });
    }

    @Test
    void seedPreservesUserMaintainedToolsAndDraftArticles() {
        seed();
        jdbc.update("UPDATE tool SET status = 0, description = ?, sort_order = 42 WHERE slug = 'json'",
                "User-maintained tool");
        jdbc.update("UPDATE tool SET status = 0, description = ?, sort_order = 43 WHERE slug = 'qrcode'",
                "User-maintained media tool");
        jdbc.update("UPDATE article SET status = 0, content = ?, view_count = 27 WHERE slug = 'online-tools-guide'",
                "User-maintained draft");
        var toolsBefore = jdbc.queryForList("SELECT * FROM tool ORDER BY id");
        var articlesBefore = jdbc.queryForList("SELECT * FROM article ORDER BY id");
        seed();
        assertThat(jdbc.queryForList("SELECT * FROM tool ORDER BY id")).isEqualTo(toolsBefore);
        assertThat(jdbc.queryForList("SELECT * FROM article ORDER BY id")).isEqualTo(articlesBefore);
    }

    private void seed() {
        var populator = new ResourceDatabasePopulator(new FileSystemResource("../sql/seed-dev.sql"));
        populator.setSqlScriptEncoding("UTF-8");
        populator.execute(dataSource);
    }
}
