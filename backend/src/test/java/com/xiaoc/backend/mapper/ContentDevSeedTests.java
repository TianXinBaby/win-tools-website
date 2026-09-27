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
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM tool", Long.class)).isEqualTo(13L);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM article", Long.class)).isEqualTo(3L);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM admin_user", Long.class)).isZero();
        var tools = toolService.listPublicTools();
        assertThat(tools).extracting(ToolVO::slug).containsExactly("json", "uuid", "timestamp", "sha256", "base64",
                "qrcode", "image-compress", "image-resize", "image-convert",
                "nickname-generator", "ascii-art", "lucky-wheel", "reaction-test");
        assertThat(tools).allSatisfy(tool -> {
            assertThat(tool.path()).isEqualTo("/tools/" + tool.slug());
            if (tool.category().equals("media")) {
                assertThat(tool.description()).contains("本地");
            } else if (tool.category().equals("developer")) {
                assertThat(tool.description()).contains("当前阶段未实现工具功能");
            } else {
                assertThat(tool.category()).isEqualTo("fun");
                assertThat(tool.description()).isNotBlank();
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
        jdbc.update("UPDATE tool SET status = 0, description = ?, sort_order = 44 WHERE slug = 'lucky-wheel'",
                "User-maintained fun tool");
        jdbc.update("UPDATE article SET status = 0, content = ?, view_count = 27 WHERE slug = 'online-tools-guide'",
                "User-maintained draft");
        var toolsBefore = jdbc.queryForList("SELECT * FROM tool ORDER BY id");
        var articlesBefore = jdbc.queryForList("SELECT * FROM article ORDER BY id");
        seed();
        assertThat(jdbc.queryForList("SELECT * FROM tool ORDER BY id")).isEqualTo(toolsBefore);
        assertThat(jdbc.queryForList("SELECT * FROM article ORDER BY id")).isEqualTo(articlesBefore);
    }

    @Test
    void funCatalogScriptIsRepeatableAndPreservesExistingRows() {
        funSeed();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM tool", Long.class)).isEqualTo(4L);
        assertThat(toolService.listPublicTools()).extracting(ToolVO::slug)
                .containsExactly("nickname-generator", "ascii-art", "lucky-wheel", "reaction-test");
        assertThat(toolService.listPublicTools()).extracting(ToolVO::name)
                .containsExactly("随机昵称生成器", "ASCII艺术生成器", "幸运转盘", "反应速度测试");
        assertThat(toolService.listPublicTools()).extracting(ToolVO::description)
                .containsExactly("随机生成游戏昵称、个性昵称。", "将文字转换为字符艺术。",
                        "自定义选项随机选择。", "测试用户反应时间。");
        assertThat(toolService.listPublicTools()).allSatisfy(tool -> {
            assertThat(tool.category()).isEqualTo("fun");
            assertThat(tool.path()).isEqualTo("/tools/" + tool.slug());
        });
        jdbc.update("UPDATE tool SET status = 0, description = ? WHERE slug = 'lucky-wheel'", "Custom wheel");
        var before = jdbc.queryForList("SELECT * FROM tool ORDER BY id");
        funSeed();
        assertThat(jdbc.queryForList("SELECT * FROM tool ORDER BY id")).isEqualTo(before);
    }

    private void seed() {
        var populator = new ResourceDatabasePopulator(new FileSystemResource("../sql/seed-dev.sql"));
        populator.setSqlScriptEncoding("UTF-8");
        populator.execute(dataSource);
    }

    private void funSeed() {
        var populator = new ResourceDatabasePopulator(new FileSystemResource("../sql/phase-11.11.2-fun-tools.sql"));
        populator.setSqlScriptEncoding("UTF-8");
        populator.execute(dataSource);
    }
}
